import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

export interface AuthTokenPayload extends JwtPayload {
  user_id: string;
  email: string;
}

const MIN_JWT_SECRET_LENGTH = 32;

export const getJWTSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be set and at least ${MIN_JWT_SECRET_LENGTH} characters long`
    );
  }

  return secret;
};

export const signAuthToken = (
  payload: Pick<AuthTokenPayload, "user_id" | "email">
): string => {
  const expiresIn = process.env.JWT_EXPIRE ?? "7d";

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: expiresIn as SignOptions["expiresIn"],
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const decoded = jwt.verify(token, getJWTSecret());

  if (
    typeof decoded === "string" ||
    typeof decoded.user_id !== "string" ||
    typeof decoded.email !== "string"
  ) {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }

  return decoded as AuthTokenPayload;
};
