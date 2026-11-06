import { verifyOtp, OtpError } from '../_lib/otp';

type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/otp/verify
 *
 * Verifies a submitted code server-side. Expiry, attempt limits and single use
 * are enforced by the trusted backend; the response never contains the code.
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const body = (req.body ?? {}) as { challengeId?: unknown; code?: unknown };
  const challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : '';
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';

  if (!UUID_PATTERN.test(challengeId)) {
    res.status(400).json({ ok: false, error: 'Invalid verification request. Please sign in again.' });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ ok: false, error: 'Enter the 6-digit code from your email.' });
    return;
  }

  try {
    const result = await verifyOtp(challengeId, code);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof OtpError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    res.status(500).json({ ok: false, error: 'Verification failed. Please try again.' });
  }
}
