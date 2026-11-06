import { createAndSendOtp, OtpError, OTP_TTL_SECONDS } from '../_lib/otp.js';

type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

/**
 * POST /api/otp/send
 *
 * Generates a verification code and emails it to the fixed recipient. No input
 * is accepted from the client, so the destination cannot be changed. The code
 * itself is never returned in the response.
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    const { challengeId } = await createAndSendOtp();
    res.status(200).json({ ok: true, challengeId, expiresInSeconds: OTP_TTL_SECONDS });
  } catch (error) {
    if (error instanceof OtpError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    res.status(500).json({ ok: false, error: 'Could not send the verification code. Please try again.' });
  }
}
