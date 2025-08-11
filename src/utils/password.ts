import bcrypt from "bcrypt";

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}
export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
