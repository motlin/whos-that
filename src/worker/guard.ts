import type {Env} from "./env.ts";

// Decides whether a POST /api/scores may go ahead, after the body is valid and before it counts toward the rate
// limits or is saved. Returning a Response refuses the score with it; returning null lets it through.
//
// This is the one place to add bot protection later without touching the game's scoring: verify a Turnstile token
// against https://challenges.cloudflare.com/turnstile/v0/siteverify with a secret binding added to Env, or check the
// Cf-Access-Jwt-Assertion header that Cloudflare Access adds. Today every valid score is allowed.
export type SubmissionGuard = (request: Request, env: Env) => Response | null | Promise<Response | null>;

export const allowAll: SubmissionGuard = () => null;
