import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Server-only OTP helpers for the admin login second factor.
 *
 * Everything in this module runs on the trusted backend (a Vercel serverless
 * function). The plaintext OTP never leaves this module: only its salted HMAC
 * is persisted, and only the fixed recipient below ever receives the code.
 */

// The OTP destination is fixed on the server and is never read from the client
// request, so a caller cannot redirect the code to a different mailbox.
export const OTP_RECIPIENT = 'jainchirag2111@gmail.com';

export const OTP_TTL_SECONDS = 5 * 60; // code lifetime: 5 minutes
const MAX_ATTEMPTS = 5; // wrong tries allowed per code
const RESEND_COOLDOWN_SECONDS = 60; // minimum gap between two sends
const MAX_SENDS_PER_HOUR = 5; // rolling send limit per hour

/** Error carrying the HTTP status the endpoint should answer with. */
export class OtpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function readEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function getServiceClient(): SupabaseClient {
  const url = readEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new OtpError('OTP service is not configured.', 500);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hashSecret(): string {
  const secret = readEnv('OTP_HASH_SALT', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new OtpError('OTP service is not configured.', 500);
  return secret;
}

/** Salted HMAC of the code. Never store or log the plaintext code. */
function hashCode(code: string): string {
  return createHmac('sha256', hashSecret()).update(code).digest('hex');
}

function generateCode(): string {
  // Node's CSPRNG. Uniform over 000000-999999.
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function deliverEmail(code: string): Promise<void> {
  const apiKey = readEnv('RESEND_API_KEY');
  if (!apiKey) {
    throw new OtpError('Email delivery is not configured.', 500);
  }

  const from = readEnv('OTP_FROM_EMAIL') || 'Paras Kachoriwala <onboarding@resend.dev>';

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [OTP_RECIPIENT],
        subject: 'Your Paras Kachoriwala admin verification code',
        text: [
          `Your admin sign-in verification code is: ${code}`,
          '',
          `This code expires in ${OTP_TTL_SECONDS / 60} minutes and can be used once.`,
          'If you did not request this code, you can safely ignore this email.',
        ].join('\n'),
      }),
    });
  } catch {
    throw new OtpError('Could not reach the email service. Please try again.', 502);
  }

  if (!response.ok) {
    throw new OtpError('Email delivery failed. Please try again.', 502);
  }
}

export type SendResult = { challengeId: string };

/**
 * Generates a fresh OTP, invalidates any previous one, stores only its hash and
 * emails the code to the fixed recipient. If the mail cannot be delivered the
 * stored code is removed and the call fails, so access is never granted.
 */
export async function createAndSendOtp(): Promise<SendResult> {
  const supabase = getServiceClient();
  const now = Date.now();

  // Server-side resend cooldown + hourly send limit.
  const windowStart = new Date(now - 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await supabase
    .from('admin_login_otp')
    .select('created_at')
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(MAX_SENDS_PER_HOUR);

  if (recentError) throw new OtpError('Could not read verification state.', 500);

  if (recent && recent.length > 0) {
    const lastSent = new Date(recent[0].created_at as string).getTime();
    const waitMs = RESEND_COOLDOWN_SECONDS * 1000 - (now - lastSent);
    if (waitMs > 0) {
      throw new OtpError(
        `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting a new code.`,
        429
      );
    }
    if (recent.length >= MAX_SENDS_PER_HOUR) {
      throw new OtpError('Too many codes requested. Please try again later.', 429);
    }
  }

  const code = generateCode();
  const challengeId = randomUUID();
  const expiresAt = new Date(now + OTP_TTL_SECONDS * 1000).toISOString();

  // Prune anything outside the rolling hour so the send limit checked above
  // stays accurate, then a new code invalidates every code still outstanding.
  await supabase.from('admin_login_otp').delete().lt('created_at', windowStart);
  await supabase.from('admin_login_otp').update({ used: true }).eq('used', false);

  const { error: insertError } = await supabase.from('admin_login_otp').insert({
    challenge_id: challengeId,
    code_hash: hashCode(code),
    expires_at: expiresAt,
    attempts: 0,
    max_attempts: MAX_ATTEMPTS,
    used: false,
  });
  if (insertError) throw new OtpError('Could not store the verification code.', 500);

  try {
    await deliverEmail(code);
  } catch (error) {
    // No email, no access: drop the stored code so it can never be used.
    await supabase.from('admin_login_otp').delete().eq('challenge_id', challengeId);
    throw error;
  }

  return { challengeId };
}

export type VerifyResult = {
  ok: boolean;
  error?: string;
  remainingAttempts?: number;
};

/**
 * Verifies a submitted code against the stored hash. Enforces expiry, attempt
 * limit and single use. The code is never echoed back in the result.
 */
export async function verifyOtp(challengeId: string, code: string): Promise<VerifyResult> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('admin_login_otp')
    .select('code_hash, expires_at, attempts, max_attempts, used')
    .eq('challenge_id', challengeId)
    .maybeSingle();

  if (error) throw new OtpError('Could not read the verification code.', 500);
  if (!data) {
    return { ok: false, error: 'This verification code is no longer valid. Please request a new one.' };
  }
  if (data.used) {
    return { ok: false, error: 'This verification code has already been used. Please request a new one.' };
  }
  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    await supabase.from('admin_login_otp').delete().eq('challenge_id', challengeId);
    return { ok: false, error: 'This verification code has expired. Please request a new one.' };
  }

  const maxAttempts = data.max_attempts as number;
  const attempts = data.attempts as number;
  if (attempts >= maxAttempts) {
    await supabase.from('admin_login_otp').delete().eq('challenge_id', challengeId);
    return { ok: false, error: 'Too many incorrect attempts. Please request a new code.', remainingAttempts: 0 };
  }

  const expected = Buffer.from(data.code_hash as string, 'hex');
  const provided = Buffer.from(hashCode(code), 'hex');
  const matches = expected.length === provided.length && timingSafeEqual(expected, provided);

  if (!matches) {
    const nextAttempts = attempts + 1;
    if (nextAttempts >= maxAttempts) {
      await supabase.from('admin_login_otp').delete().eq('challenge_id', challengeId);
      return { ok: false, error: 'Too many incorrect attempts. Please request a new code.', remainingAttempts: 0 };
    }
    await supabase.from('admin_login_otp').update({ attempts: nextAttempts }).eq('challenge_id', challengeId);
    return { ok: false, error: 'Incorrect verification code.', remainingAttempts: maxAttempts - nextAttempts };
  }

  // Success: burn this code and clear any leftovers.
  await supabase.from('admin_login_otp').update({ used: true }).eq('challenge_id', challengeId);
  await supabase.from('admin_login_otp').delete().neq('challenge_id', challengeId);

  return { ok: true };
}
