import { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken } from "./jwt";

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return reply.code(401).send({ message: "Unauthorized" });
  try {
    req.user = verifyToken(token);
  } catch {
    return reply.code(401).send({ message: "Unauthorized" });
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.user?.role !== "admin") {
    return reply.code(403).send({ message: "Forbidden" });
  }
}
