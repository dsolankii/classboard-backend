import { FastifyInstance } from "fastify";
import { z } from "zod";
import { User } from "../models/User";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";

export async function authRoutes(app: FastifyInstance) {
  // SIGN UP
  app.post("/auth/register", async (req, reply) => {
    const body = z
      .object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["admin", "teacher", "student"]).optional(), // client may send, we'll restrict
      })
      .parse(req.body);

    // block self-creating admin; default to student unless teacher/student specified
    const safeRole = body.role && body.role !== "admin" ? body.role : "student";

    const exists = await User.findOne({ email: body.email });
    if (exists) return reply.code(409).send({ message: "Email already in use" });

    const passwordHash = await hashPassword(body.password);
    const user = await User.create({
      name: body.name,
      email: body.email,
      passwordHash,
      role: safeRole,
    });

    const token = signToken({ sub: user._id.toString(), role: user.role as any });
    return { token };
  });

  // LOGIN
  app.post("/auth/login", async (req, reply) => {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);

    const user = await User.findOne({ email });
    if (!user || user.disabled) return reply.code(401).send({ message: "Invalid credentials" });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ message: "Invalid credentials" });

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({ sub: user._id.toString(), role: user.role as any });
    return { token };
  });
}
