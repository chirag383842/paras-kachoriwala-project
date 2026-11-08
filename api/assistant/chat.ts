import {
  AssistantError,
  SECRET_REFUSAL,
  askAssistant,
  isSecretSeeking,
  type ChatMessage,
} from '../_lib/assistant.js';

type ApiRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};
type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

const MAX_MESSAGE_CHARS = 600;
const MAX_HISTORY = 8;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

/**
 * Best-effort per-instance rate limit. Serverless instances are recycled, so
 * this is an abuse brake, not a hard quota — the provider key itself should
 * also carry its own usage limit.
 */
const rateHits = new Map<string, { count: number; resetAt: number }>();

function header(req: ApiRequest, name: string): string {
  const value = req.headers?.[name];
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function clientIp(req: ApiRequest): string {
  const forwarded = header(req, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return header(req, 'x-real-ip') || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateHits.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

/**
 * Only the website itself may call this endpoint, so a third-party site cannot
 * borrow the assistant (and your provider credits) from its visitors' browsers.
 */
function isAllowedOrigin(req: ApiRequest): boolean {
  const origin = header(req, 'origin');
  if (!origin) return true; // no Origin header: not a cross-site browser call
  try {
    const originHost = new URL(origin).host;
    const host = header(req, 'x-forwarded-host') || header(req, 'host');
    if (!host) return true;
    if (originHost === host) return true;
    return originHost.startsWith('localhost:') || originHost.startsWith('127.0.0.1:');
  } catch {
    return false;
  }
}

type ParsedBody = { message: string; history: ChatMessage[] };

function parseBody(body: unknown): ParsedBody | null {
  let raw: unknown = body;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;

  const source = raw as Record<string, unknown>;
  const message = typeof source.message === 'string' ? source.message.trim() : '';
  if (!message) return null;

  const history: ChatMessage[] = [];
  const rawHistory = Array.isArray(source.history) ? source.history : [];
  for (const entry of rawHistory) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
    const content = typeof item.content === 'string' ? item.content.trim() : '';
    if (!role || !content) continue;
    history.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }

  return {
    message: message.slice(0, MAX_MESSAGE_CHARS),
    history: history.slice(-MAX_HISTORY),
  };
}

/**
 * POST /api/assistant/chat
 *
 * Answers customer questions about the shop using live public data only.
 * Refuses anything about keys, passwords, OTPs, the database, the admin portal
 * or source code before the model is called. The AI provider key stays on the
 * server and is never returned, logged or sent to the browser.
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  if (!isAllowedOrigin(req)) {
    res.status(403).json({ ok: false, error: 'This endpoint is only available on this website.' });
    return;
  }

  if (isRateLimited(clientIp(req))) {
    res
      .status(429)
      .json({ ok: false, error: 'Too many messages. Please wait a few minutes and try again.' });
    return;
  }

  const parsed = parseBody(req.body);
  if (!parsed) {
    res.status(400).json({ ok: false, error: 'Please type a question about the shop.' });
    return;
  }

  // Refused here so a secret request never reaches the model at all.
  if (isSecretSeeking(parsed.message)) {
    res.status(200).json({ ok: true, reply: SECRET_REFUSAL });
    return;
  }

  try {
    const reply = await askAssistant([
      ...parsed.history,
      { role: 'user', content: parsed.message },
    ]);
    res.status(200).json({ ok: true, reply });
  } catch (error) {
    if (error instanceof AssistantError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    // Never surface internal error details to the browser.
    res.status(500).json({ ok: false, error: 'The assistant is unavailable right now. Please try again later.' });
  }
}
