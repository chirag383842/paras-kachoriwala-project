# Debug Session: otp-invalid-json
- **Status**: [OPEN]
- **progress_status**: analyzed; awaiting production redeploy
- **Issue**: After redeploying through a new GitHub/Vercel project, the admin login still reports that the OTP API returned a non-JSON response.
- **Evidence Source**: HTTP Debug Server and Vercel deployment/function logs
- **Evidence Directory**: C:\Users\chira\AppData\Local\Temp\trae-debug\project-copy\otp-invalid-json
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: C:\Users\chira\AppData\Local\Temp\trae-debug\project-copy\otp-invalid-json\trae-debug-log-otp-invalid-json.ndjson

## Reproduction Steps
1. Probe `/api/otp/send` with GET (expected method-rejection JSON; does not send an OTP).
2. Inspect the active Vercel project's deployment commit and function logs.
3. If the deployment identity is confirmed, retry the login request once and record status/content type without recording credentials, OTP values, or response secrets.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The new project/domain is serving a different or older deployment than the source containing the `.js` import fix. | High | Low | REJECTED: Vercel lists production commit `adb2d1b`; inspect confirms the stable alias targets that deployment. |
| B | The active deployment's function bundle still fails to load or invoke. | High | Low | CONFIRMED: runtime log at 2026-11-06T18:45:01.571Z says `ReferenceError: exports is not defined in ES module scope` at `/var/task/api/otp/send.js:2`; local NodeNext output is ESM. Production fix awaits redeploy. |
| C | The function loads but an environment/configuration failure returns a platform/non-JSON response. | Medium | Low | REJECTED as the current cause: the function crashes during module evaluation, before handler environment checks. |
| D | The API request is being rewritten to the Vite SPA and returns HTML. | Low | Low | REJECTED: Vercel runtime log identifies `source=function`, request path `/api/otp/send`, status 500, content type `text/plain`. |

## Log Evidence
Pre-fix production evidence:
- Deployment `dpl_sm2xKuXWxoHXkkUaq84buiPXeeZo` uses commit `adb2d1b6cdb8367693ed9700903a6f9a48d4ce5e`, and the stable domain is an alias on that deployment.
- Runtime log request `5pf96-1793990700922-ff60925d17cf` at `2026-11-06T18:45:01.571Z` reports `ReferenceError: exports is not defined in ES module scope`. The root `package.json` declares `"type": "module"`, while `api/tsconfig.json` had emitted CommonJS.
- Safe GET probe of the stable API URL returned HTTP 500, `text/plain`, `FUNCTION_INVOCATION_FAILED`.
- The API tsconfig now uses `module: NodeNext` and `moduleResolution: NodeNext`. `npx tsc --noEmit -p api/tsconfig.json` passes, and compiled `send.js`/`verify.js` use ESM `import`/`export`.
- HTTP event evidence: `C:\Users\chira\AppData\Local\Temp\trae-debug\project-copy\otp-invalid-json\trae-debug-log-otp-invalid-json.ndjson`.

## Verification Conclusion
Local compiler output verifies the corrected module format, but there is no post-fix production runtime evidence yet. The current live alias still serves the pre-fix function bundle. Keep the session open until a new production deployment is available and its safe GET probe returns JSON `405 Method not allowed`.

## Final Evidence Gate
- **Evidence Sources**: Vercel deployment/function logs and `C:\Users\chira\AppData\Local\Temp\trae-debug\project-copy\otp-invalid-json\trae-debug-log-otp-invalid-json.ndjson`
- **progress_status**: analyzed; awaiting production redeploy
- **Hypothesis Conclusions**: A REJECTED; B CONFIRMED; C REJECTED; D REJECTED
