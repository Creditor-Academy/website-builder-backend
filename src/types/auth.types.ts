export type AuthUser = {
  id: string;
  role: string;
  refreshTokenId: string;
  institution_id?: string;
};

export type JWTPayload = {
  userId: string;
  role: string;
  refreshTokenId: string;
  sessionId: string;
  institution_id?: string;
};