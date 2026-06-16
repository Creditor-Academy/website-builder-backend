export const generateJWTPayload = (user: any, sessionId: string) => {
    return {
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId,
        institution_id: user.institution_id || undefined
    };
}

export const generateSessionPayload = (user: any, refreshTokenHash: string) => {
    return {
        userId: user.id,
        role: user.role,
        refreshTokenId: refreshTokenHash,
        institution_id: user.institution_id || undefined,
        isVerified: user.isVerified ?? false,
        createdAt: new Date(),
    };
}