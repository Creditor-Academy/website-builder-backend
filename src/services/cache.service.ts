import { getRedisClient } from '../config/redis-client.js';

class CacheService {
    // Lazy initialization of Redis client
    // access using this.client to use the Redis client instance
    get client() {
        return getRedisClient();
    }

    /**
     * Retrieves a cached value by key from Redis.
     * @param {string} key - The cache key to retrieve
     * @return - The cached value, or null if not found or on error
     */
    async get(key: string) {
        try {
            const value = await this.client.get(key);
            return value;
        } catch (error) {
            console.error(`Error getting cache for key ${key}:`, error);
            return null;
        }
    }

    /**
     * Sets a value in the cache with an optional TTL (time to live)
     * @param {string} key - The cache key to set
     * @param {*} value - The value to cache
     * @param {number} ttl - Time to live in seconds (default: 3600)
     */
    async set(key: string, value: any, ttl: number = 3600) {
        try {
            await this.client.set(
                key,
                JSON.stringify(value),
                { ex: ttl }
            );
        }
        catch (error) {
            console.error(`Error setting cache for key ${key}:`, error);
        }
    }

    /**
     * Deletes a cache entry by key from Redis.
     * @param {string} key - The cache key to delete
     */
    async del(key: string) {
        try {
            await this.client.del(key);
        }
        catch (error) {
            console.error(`Error deleting cache for key ${key}:`, error);
        }
    }

    /**
     * Clears cache entries matching a pattern
     * @param {string} pattern - The pattern to match cache keys (e.g., 'user:*')
     */
    async clear(pattern: string) {
        try {
            let cursor: number = 0;
            do {
                const result = await this.client.scan(cursor, { match: pattern, count: 100 });
                cursor = Number(result[0]);
                const keys = result[1] as string[];
                if (keys.length > 0) {
                    await Promise.all(keys.map((key) => this.client.del(key)));
                }
            } while (cursor !== 0);
        }
        catch (error) {
            console.error(`Error clearing cache with pattern ${pattern}:`, error);
        }
    }

    async increment(key: string, window: number) {
        // Atomic INCR + EXPIRE via Lua (race condition safe)
        const SCRIPT = `
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            return count
        `;
        try {
            const count: number = await this.client.eval(SCRIPT, [key], [window]);
            return count;
        }
        catch (error) {
            console.error(`Error incrementing cache for key ${key}:`, error);
            return 0;
        }
    }
}

export default new CacheService();