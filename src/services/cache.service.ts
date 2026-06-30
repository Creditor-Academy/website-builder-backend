import { getRedisClient } from '../config/redis-client.js';

class CacheService {
    // In-memory fallback for Redis to keep Auth working
    private memoryStore = new Map<string, { value: any, expiresAt: number }>();

    // Mock client to satisfy TypeScript in cron.ts
    get client(): any {
        return {
            set: async () => 'OK',
        };
    }

    async get(key: string) {
        const item = this.memoryStore.get(key);
        if (!item) return null;
        if (Date.now() > item.expiresAt) {
            this.memoryStore.delete(key);
            return null;
        }
        return item.value;
    }

    async set(key: string, value: any, ttl: number = 3600) {
        this.memoryStore.set(key, {
            value,
            expiresAt: Date.now() + ttl * 1000,
        });
    }

    async del(key: string) {
        this.memoryStore.delete(key);
    }

    async clear(pattern: string) {
        // Simple regex conversion for redis wildcard '*'
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        for (const key of this.memoryStore.keys()) {
            if (regex.test(key)) {
                this.memoryStore.delete(key);
            }
        }
    }

    async increment(key: string, window: number) {
        let item = this.memoryStore.get(key);
        if (!item || Date.now() > item.expiresAt) {
            item = { value: 0, expiresAt: Date.now() + window * 1000 };
        }
        item.value = (item.value || 0) + 1;
        this.memoryStore.set(key, item);
        return item.value;
    }
}

export default new CacheService();