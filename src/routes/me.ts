import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../utils/authGuard";
import { User } from "../models/User";
import { verifyPassword, hashPassword } from "../utils/password";

// validation for PATCH /me
const updateMeSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(300).optional(),
  avatarUrl: z.string().url().optional(),
  preferences: z.object({
    theme: z.enum(["system", "light", "dark"]).optional(),
    density: z.enum(["comfortable", "compact"]).optional(),
    language: z.string().optional(),
  }).optional(),
});

// validation for POST /me/change-password
const changePasswordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(6),
});

export async function meRoutes(app: FastifyInstance) {
  // who am i
  app.get("/me", { preHandler: [requireAuth] }, async (req) => {
    const me = await User.findById(req.user!.sub).select("-passwordHash");
    return me;
  });

  // update my profile
  app.patch("/me", { preHandler: [requireAuth] }, async (req) => {
    const body = updateMeSchema.parse(req.body);
    const me = await User.findByIdAndUpdate(
      req.user!.sub,
      { $set: body },
      { new: true }
    ).select("-passwordHash");
    return me;
  });

  // change my password
  app.post("/me/change-password", { preHandler: [requireAuth] }, async (req, reply) => {
    const { current, next } = changePasswordSchema.parse(req.body);
    const user = await User.findById(req.user!.sub);
    if (!user) return reply.code(404).send({ message: "User not found" });

    const ok = await verifyPassword(current, user.passwordHash);
    if (!ok) return reply.code(400).send({ message: "Current password incorrect" });

    user.passwordHash = await hashPassword(next);
    await user.save();
    return { ok: true };
  });
}
