export const MAX_ATTEMPTS = 5;
export const MAX_CONCURRENT_TASKS_PER_AGENT = 2;
export const MAX_TASKS_PER_DAY_PER_AGENT = 240;
export const MAX_AUTOMATIC_APPROVED_RISK_SCORE = 0.15;
export const TASK_RESULT_STALE_MS = 15 * 60 * 1000;
export const CLAIM_STALE_MS = 10 * 60 * 1000;
export const HEARTBEAT_STALE_MS = 2 * 60 * 1000;
export const ALLOW_STRIPE_LIVE_CREATE = process.env.ALLOW_STRIPE_LIVE_CREATE === "true";

export function calculateBackoffUntil(attempts: number, now = Date.now()) {
  const delayMs = Math.min(30 * 60 * 1000, Math.max(30 * 1000, 2 ** Math.max(0, attempts - 1) * 30 * 1000));
  return new Date(now + delayMs).toISOString();
}
