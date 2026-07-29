import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW = "60 s";

// Vercel's Upstash Marketplace integration injects KV_REST_API_URL/KV_REST_API_TOKEN
// (its "KV" naming), not the classic UPSTASH_REDIS_REST_URL/TOKEN that Redis.fromEnv() expects.
const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW),
  analytics: true,
  prefix: "ratelimit",
});

// Fails open: if Upstash is unreachable or errors, we let the request through rather than
// breaking story generation for everyone over a transient Redis blip.
export async function checkRateLimit(identifier: string): Promise<boolean> {
  try {
    const { success } = await ratelimit.limit(identifier);
    return success;
  } catch (error) {
    console.error("Rate limit check failed, failing open:", error);
    return true;
  }
}
