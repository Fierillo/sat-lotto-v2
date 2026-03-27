import { queryNeon } from './db';

const WINDOW_SECONDS = 60;

const limits = {
    'bet:create:pubkey': 3,
    'bet:create:ip': 3,
    'bet:confirm:pubkey': 3,
    'state:ip': 12,
    'identity:ip': 10
};

export type RateLimitKey = keyof typeof limits;

export async function checkRateLimit(
    keyType: RateLimitKey,
    identifier: string
): Promise<{ allowed: boolean; remaining: number }> {
    const key = `${keyType}:${identifier}`;
    const maxRequests = limits[keyType];

    try {
        const now = new Date();
        const windowStart = new Date(now.getTime() - WINDOW_SECONDS * 1000);

        const existing = await queryNeon(
            'SELECT count, window_start FROM rate_limits WHERE key = $1',
            [key]
        );

        if (existing.length === 0) {
            await queryNeon(
                'INSERT INTO rate_limits (key, count, window_start) VALUES ($1, 1, $2)',
                [key, now]
            );
            return { allowed: true, remaining: maxRequests - 1 };
        }

        const { count, window_start } = existing[0];
        const windowStartTime = new Date(window_start);

        if (windowStartTime < windowStart) {
            await queryNeon(
                'UPDATE rate_limits SET count = 1, window_start = $1 WHERE key = $2',
                [now, key]
            );
            return { allowed: true, remaining: maxRequests - 1 };
        }

        if (count >= maxRequests) {
            console.error(`[RateLimit] Blocked: ${key} - ${count}/${maxRequests} in ${WINDOW_SECONDS}s`);
            return { allowed: false, remaining: 0 };
        }

        await queryNeon(
            'UPDATE rate_limits SET count = count + 1 WHERE key = $1',
            [key]
        );

        return { allowed: true, remaining: maxRequests - count - 1 };
    } catch (err) {
        console.error('[RateLimit] Error:', err);
        return { allowed: true, remaining: maxRequests };
    }
}

export async function getClientIP(request: Request): Promise<string> {
    const forwarded = request.headers.get('x-forwarded-for');
    return forwarded?.split(',')[0]?.trim() || 
           request.headers.get('x-real-ip') || 
           'unknown';
}
