import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW = "60 s";

// Vercel's Upstash Marketplace integration injects KV_REST_API_URL/KV_REST_API_TOKEN
// (its "KV" naming), not the classic UPSTASH_REDIS_REST_URL/TOKEN that Redis.fromEnv() expects.
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW),
  analytics: true,
  prefix: "ratelimit",
});

// Interactive mode advances one beat per tap, so the 3/60s story-start budget above would block
// normal stepping after three presses. Beats are cheap Haiku calls, so they get their own, more
// generous window (still capped to bound per-IP spend). Separate prefix = separate counter.
const STEP_RATE_LIMIT_MAX_REQUESTS = 15;
const stepRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(STEP_RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW),
  analytics: true,
  prefix: "ratelimit:step",
});

// On an Upstash error we default to failing OPEN (allow the request) so a transient Redis blip
// doesn't break story generation for everyone. Callers guarding a paid endpoint (image generation)
// pass failClosed=true: there, an outage should block rather than leave per-IP spend uncapped (#47) -
// a missing cover degrades gracefully to the story-only reader.
export async function checkRateLimit(identifier: string, failClosed = false): Promise<boolean> {
  try {
    const { success } = await ratelimit.limit(identifier);
    return success;
  } catch (error) {
    console.error(`Rate limit check failed, failing ${failClosed ? "closed" : "open"}:`, error);
    return !failClosed;
  }
}

// Per-IP limiter for interactive beat steps (#37). Fails open like story generation - a transient
// Redis blip shouldn't strand a reader mid-story.
export async function checkStepRateLimit(identifier: string): Promise<boolean> {
  try {
    const { success } = await stepRatelimit.limit(identifier);
    return success;
  } catch (error) {
    console.error("Step rate limit check failed, failing open:", error);
    return true;
  }
}
