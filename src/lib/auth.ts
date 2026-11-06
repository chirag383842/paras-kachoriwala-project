import { supabase } from './supabase';

// Secure Authentication Utility for Paras Kachoriwala Author/Owner portal

export type AuthUser = {
  email: string;
  name: string;
  role: string;
};

export type AuthSession = {
  user: AuthUser;
  token: string;
  createdAt: number;
  lastActive: number;
};

// Security constants
const AUTH_SALT = 'pk_secure_salt_8923a1_paras';
// SHA-256 hash of "<password>:<salt>" for the author account. The plaintext
// password is never stored here or anywhere else in the source.
const AUTHOR_EMAIL = 'paras@gmail.com';
const AUTHOR_PASSWORD_HASH = 'c1691d918c6b3f4544be2994ea89f6806f07d62c829af9b0664acb78b613e303';
const AUTHOR_NAME = 'Chirag Jain';
const AUTHOR_ROLE = 'Owner & Author';


const STORAGE_SESSION_KEY = 'pk_author_auth_session_v2';
const STORAGE_RATE_LIMIT_KEY = 'pk_auth_rate_limit';
const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours inactivity timeout
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout

// In-memory mirror of the author session. localStorage writes can legitimately
// fail (private browsing, or a quota already consumed by the base64 gallery
// cache). When that happens a validly authenticated admin must keep working for
// the current page instead of being bounced back to the login screen.
let memorySession: AuthSession | null = null;

// Guards against duplicate Supabase Auth requests when the login form is
// submitted repeatedly (double clicks, retries after a slow response).
let supabaseAuthBridgeInFlight = false;

/**
 * Computes SHA-256 hash with salt using Web Crypto API
 */
async function computeHash(text: string, salt: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(`${text}:${salt}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback simple bitwise hash for legacy environments
    let hash = 0;
    const str = `${text}:${salt}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString(16);
  }
}

type RateLimitData = {
  failedAttempts: number;
  lockedUntil: number | null;
};

function getRateLimitData(): RateLimitData {
  try {
    const raw = sessionStorage.getItem(STORAGE_RATE_LIMIT_KEY);
    if (!raw) return { failedAttempts: 0, lockedUntil: null };
    return JSON.parse(raw);
  } catch {
    return { failedAttempts: 0, lockedUntil: null };
  }
}

function saveRateLimitData(data: RateLimitData): void {
  try {
    sessionStorage.setItem(STORAGE_RATE_LIMIT_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage issues
  }
}

export function checkLockout(): { isLocked: boolean; remainingSeconds: number } {
  const { lockedUntil } = getRateLimitData();
  if (lockedUntil && lockedUntil > Date.now()) {
    const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
    return { isLocked: true, remainingSeconds: remaining };
  }
  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Best-effort bridge that also signs the author in with Supabase Auth so
 * PostgREST requests can run with the `authenticated` role.
 *
 * It is intentionally fire-and-forget: admin authorization is decided by the
 * verified local session above, and the database policies accept the anon
 * role. Awaiting this request made the login form depend on the round-trip
 * time (and on supabase-js' internal auth lock), which is what produced the
 * intermittent "correct credentials, no authorization" failures.
 */
function bridgeSupabaseAuth(password: string): void {
  if (supabaseAuthBridgeInFlight) return; // avoid duplicate auth requests
  supabaseAuthBridgeInFlight = true;

  void (async () => {
    try {
      const { error: sbAuthErr } = await supabase.auth.signInWithPassword({
        email: AUTHOR_EMAIL,
        password,
      });
      if (sbAuthErr) {
        // If the author is not registered in Supabase Auth yet, create the
        // account and retry once.
        await supabase.auth.signUp({ email: AUTHOR_EMAIL, password });
        await supabase.auth.signInWithPassword({ email: AUTHOR_EMAIL, password });
      }
    } catch {
      // Best effort only: a slow or unreachable Auth service must never block
      // or fail the admin login.
    } finally {
      supabaseAuthBridgeInFlight = false;
    }
  })();
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string; remainingSeconds?: number }> {
  // 1. Check rate limiting
  const lockout = checkLockout();
  if (lockout.isLocked) {
    return {
      success: false,
      error: `Too many failed attempts. Please wait ${lockout.remainingSeconds} seconds before trying again.`,
      remainingSeconds: lockout.remainingSeconds,
    };
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  // Basic format validation
  if (!cleanEmail || !cleanPass) {
    return { success: false, error: 'Please enter both your email address and password.' };
  }

  // 2. Compute secure salted hash
  const hash = await computeHash(cleanPass, AUTH_SALT);

  const emailMatches = cleanEmail === AUTHOR_EMAIL.toLowerCase();
  const hashMatches = hash === AUTHOR_PASSWORD_HASH;

  if (emailMatches && hashMatches) {
    // Reset rate limiter on successful login
    saveRateLimitData({ failedAttempts: 0, lockedUntil: null });

    const user: AuthUser = {
      email: AUTHOR_EMAIL,
      name: AUTHOR_NAME,
      role: AUTHOR_ROLE,
    };

    // Generate random cryptographic session token (Session Fixation protection)
    const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const now = Date.now();

    const session: AuthSession = {
      user,
      token,
      createdAt: now,
      lastActive: now,
    };

    try {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    } catch {
      // Storage unavailable (private mode / quota exhausted) — the in-memory
      // session below keeps this page authorised.
    }
    memorySession = session;
    window.dispatchEvent(new Event('pk_auth_state_changed'));

    // Bridge authentication with Supabase Auth in the background. It never
    // delays or fails the local login.
    bridgeSupabaseAuth(cleanPass);

    return { success: true, user };
  }

  // Handle failed attempt & rate limiting
  const currentLimit = getRateLimitData();
  const newFailed = currentLimit.failedAttempts + 1;
  let lockedUntil = currentLimit.lockedUntil;

  if (newFailed >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    saveRateLimitData({ failedAttempts: 0, lockedUntil });
    return {
      success: false,
      error: `Too many failed attempts. Login locked for 5 minutes for security.`,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  saveRateLimitData({ failedAttempts: newFailed, lockedUntil: null });

  return {
    success: false,
    error: 'Invalid email address or password. Please try again.',
  };
}

export function logout(): void {
  try {
    memorySession = null;
    localStorage.removeItem(STORAGE_SESSION_KEY);
    void supabase.auth.signOut().catch(() => {});
    window.dispatchEvent(new Event('pk_auth_state_changed'));
  } catch {
    // Ignore
  }
}

export function getAuthUser(): AuthUser | null {
  try {
    const now = Date.now();
    let session: AuthSession | null = null;

    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (raw) {
        try {
          session = JSON.parse(raw) as AuthSession;
        } catch {
          // Corrupt entry — drop it and fall back to the in-memory session.
          localStorage.removeItem(STORAGE_SESSION_KEY);
        }
      }
    } catch {
      // Storage unavailable — fall back to the in-memory session.
    }

    if (!session) session = memorySession;

    if (!session || !session.user || !session.lastActive) return null;

    // Check session expiration (2 hours of inactivity)
    if (now - session.lastActive > SESSION_EXPIRY_MS) {
      logout();
      return null;
    }

    // Refresh last active timestamp
    session.lastActive = now;
    memorySession = session;
    try {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    } catch {
      // Keep the in-memory session alive when storage is unavailable.
    }

    return session.user;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getAuthUser() !== null;
}
