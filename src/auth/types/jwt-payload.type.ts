export type JwtPayload = {
  sub: string;
  sid: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};
