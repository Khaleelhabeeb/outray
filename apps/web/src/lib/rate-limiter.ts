import { redis } from "./redis";

interface RateLimitConfig {
    identifier: string;
    maxRequests: number;
    windowSeconds: number;
}

interface RateLimitResult {
    allowed: boolean;
    current: number;
    limit: number;
    resetIn: number;
    remaining: number;
}

/**
 * Redis-based sliding window rate limiter.
 * Uses a sorted set with timestamps for accurate windowed counting.
 */
export async function rateLimit(
    key: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const windowStart = now - windowMs;
    const redisKey = `ratelimit:${config.identifier}:${key}`;

    const pipeline = redis.pipeline();

    pipeline.zremrangebyscore(redisKey, 0, windowStart);

    pipeline.zcard(redisKey);

    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);

    pipeline.expire(redisKey, config.windowSeconds + 1);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;

    const allowed = currentCount < config.maxRequests;
    const resetIn = Math.ceil(config.windowSeconds - ((now - windowStart) / 1000));

    return {
        allowed,
        current: currentCount + (allowed ? 1 : 0),
        limit: config.maxRequests,
        resetIn: Math.max(0, resetIn),
        remaining: Math.max(0, config.maxRequests - currentCount - 1),
    };
}

export function getClientIdentifier(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }

    return "unknown";
}


export function createRateLimitResponse(result: RateLimitResult): Response {
    return new Response(
        JSON.stringify({
            error: "Too many requests",
            retryAfter: result.resetIn,
        }),
        {
            status: 429,
            headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Limit": result.limit.toString(),
                "X-RateLimit-Remaining": result.remaining.toString(),
                "X-RateLimit-Reset": result.resetIn.toString(),
                "Retry-After": result.resetIn.toString(),
            },
        }
    );
}


export const rateLimiters = {
    /** CLI login session creation - 10 per minute per IP */
    cliLogin: (key: string) =>
        rateLimit(key, {
            identifier: "cli-login",
            maxRequests: 10,
            windowSeconds: 60,
        }),

    /** CLI login status polling - 60 per minute per IP (allows 5s intervals) */
    cliLoginStatus: (key: string) =>
        rateLimit(key, {
            identifier: "cli-login-status",
            maxRequests: 60,
            windowSeconds: 60,
        }),

    /** Tunnel authentication - 30 per minute per IP */
    tunnelAuth: (key: string) =>
        rateLimit(key, {
            identifier: "tunnel-auth",
            maxRequests: 30,
            windowSeconds: 60,
        }),

    /** Tunnel registration - 20 per minute per IP */
    tunnelRegister: (key: string) =>
        rateLimit(key, {
            identifier: "tunnel-register",
            maxRequests: 20,
            windowSeconds: 60,
        }),

    /** Token exchange - 20 per minute per IP */
    tokenExchange: (key: string) =>
        rateLimit(key, {
            identifier: "token-exchange",
            maxRequests: 20,
            windowSeconds: 60,
        }),

    /** General API - 100 per minute per IP */
    general: (key: string) =>
        rateLimit(key, {
            identifier: "general",
            maxRequests: 100,
            windowSeconds: 60,
        }),
};
