import jwt from "jsonwebtoken";

export type JwtPayload = { sub: string };

export function signUserToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: "30d" });
}

export function verifyUserToken(token: string, secret: string): JwtPayload {
  const decoded = jwt.verify(token, secret) as JwtPayload;
  return decoded;
}
