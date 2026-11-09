import { describeAssistant } from '../_lib/assistant.js';

type ApiRequest = { method?: string };
type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

/**
 * GET /api/assistant/status
 *
 * Configuration report for the site owner. It shows whether the key is set,
 * which host and model are configured, and what the AI provider answers, so a
 * broken deployment can be diagnosed without reading server logs. The key
 * itself is never read out or returned.
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  res.status(200).json({ ok: true, ...(await describeAssistant()) });
}
