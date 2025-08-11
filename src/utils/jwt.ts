import jwt from "jsonwebtoken";
import { config } from "../config/env";

type Role = "admin" | "teacher" | "student";
type Payload = { sub: string; role: Role };

export function signToken(payload: Payload) {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "7d" });
}
export function verifyToken(token: string): Payload {
  return jwt.verify(token, process.env.JWT_SECRET as string) as Payload;
}
