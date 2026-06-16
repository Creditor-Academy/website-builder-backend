// Generates Redis key for authentication sessions)
// If userId or sessionId is not provided, it defaults to '*' for pattern matching
export const generateAuthSessionKey = (userId: string = '*', sessionId: string = '*') => {
    return `session:${userId}:${sessionId}`;
}

// Generates Redis key for domain → websiteId routing cache
// Used by domain-router.middleware.ts for fast host-based lookups
export const generateDomainCacheKey = (hostname: string) => {
    return `domain:${hostname}`;
}

// Generates Redis key for domain certificate polling lock
// Prevents concurrent poll runs from overlapping
export const generateCertPollLockKey = () => {
    return `lock:cert-poll`;
}