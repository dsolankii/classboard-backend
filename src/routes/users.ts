import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../utils/authGuard";
import { User } from "../models/User";
import { parseDateOrNull } from "../utils/dates";
import { hashPassword } from "../utils/password";

// create & update validators
const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "teacher", "student"]),
  bio: z.string().max(300).optional(),
  avatarUrl: z.string().url().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["admin", "teacher", "student"]).optional(),
  bio: z.string().max(300).optional(),
  avatarUrl: z.string().url().optional(),
  disabled: z.boolean().optional(),
  preferences: z
    .object({
      theme: z.enum(["system", "light", "dark"]).optional(),
      density: z.enum(["comfortable", "compact"]).optional(),
      language: z.string().optional(),
    })
    .optional(),
});

export async function usersRoutes(app: FastifyInstance) {
  // LIST with filters + pagination + sort
  app.get("/users", { preHandler: [requireAuth] }, async (req) => {
    const q = req.query as any;

    const role = q.role as string | undefined; // admin|teacher|student|all
    const keyword = (q.q as string | undefined)?.trim();
    const start = parseDateOrNull(q.start as string | undefined);
    const end = parseDateOrNull(q.end as string | undefined);
    const page = Math.max(1, parseInt((q.page ?? "1") as string, 10));
    const limit = Math.min(50, Math.max(1, parseInt((q.limit ?? "10") as string, 10)));
    const [field, dir] = ((q.sort as string | undefined) ?? "createdAt:desc").split(":");
    const sortSpec: Record<string, 1 | -1> = { [field]: dir === "asc" ? 1 : -1 };

const filter: any = {};
if (role && role !== "all") filter.role = role;

if (keyword) {
  // DEFAULTS changed here 👇
  const scope = (q.scope as string) ?? "name";           // default: name
  const mode  = (q.mode as string)  ?? "startsWith";     // default: startsWith

  const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = mode === "startsWith" ? `^${safe}` : safe;
  const re = new RegExp(pattern, "i");

  if (scope === "name")       filter.name = re;
  else if (scope === "email") filter.email = re;
  else                        filter.$or = [{ name: re }, { email: re }];
}

if (start || end) {
  filter.createdAt = {};
  if (start) filter.createdAt.$gte = start;
  if (end)   filter.createdAt.$lte = end;
}


    const total = await User.countDocuments(filter);
    const data = await User.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-passwordHash");

    return { data, page, total };
  });

  // QUICK SUGGESTIONS for global search
app.get("/users/suggestions", { preHandler: [requireAuth] }, async (req) => {
  const q = req.query as any;
  const keyword = (q.q as string | undefined)?.trim();
  const limit = Math.min(20, Math.max(1, parseInt((q.limit ?? "8") as string, 10)));
  if (!keyword) return [];

  const scope = (q.scope as string) ?? "name";          // default: name
  const mode  = (q.mode as string)  ?? "startsWith";    // default: startsWith

  const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = mode === "startsWith" ? `^${safe}` : safe;
  const re = new RegExp(pattern, "i");

  const match =
    scope === "name"  ? { name: re } :
    scope === "email" ? { email: re } :
                        { $or: [{ name: re }, { email: re }] };

  const users = await User.find(match)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("name email role");

  return users.map(u => ({ id: u._id.toString(), name: u.name, email: u.email, role: u.role }));
});


  // GET by id (for quick view drawer)
  app.get("/users/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as any;
    const u = await User.findById(id).select("-passwordHash");
    if (!u) return reply.code(404).send({ message: "Not found" });
    return u;
  });

  // CREATE (admin only)
  app.post("/users", { preHandler: [requireAdmin] }, async (req, reply) => {
    const body = createUserSchema.parse(req.body);
    const exists = await User.findOne({ email: body.email });
    if (exists) return reply.code(409).send({ message: "Email already in use" });

    const passwordHash = await hashPassword(body.password);
    const created = await User.create({
      name: body.name,
      email: body.email,
      role: body.role,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
      passwordHash,
    });

    return reply.code(201).send(created);
  });

  // UPDATE (admin or self-limited)
  app.patch("/users/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as any;
    const body = updateUserSchema.parse(req.body);

    const isAdmin = req.user?.role === "admin";
    const isSelf = req.user?.sub === id;

    if (!isAdmin && !isSelf) {
      return reply.code(403).send({ message: "Forbidden" });
    }

    // if not admin, restrict fields to name/bio/avatarUrl/preferences
    const updateDoc: any = isAdmin
      ? body
      : {
          ...(body.name ? { name: body.name } : {}),
          ...(body.bio ? { bio: body.bio } : {}),
          ...(body.avatarUrl ? { avatarUrl: body.avatarUrl } : {}),
          ...(body.preferences ? { preferences: body.preferences } : {}),
        };

    const updated = await User.findByIdAndUpdate(id, { $set: updateDoc }, { new: true }).select(
      "-passwordHash"
    );
    return updated;
  });

  // DELETE (admin only)
  app.delete("/users/:id", { preHandler: [requireAdmin] }, async (req) => {
    const { id } = req.params as any;
    await User.findByIdAndDelete(id);
    return { ok: true };
  });

  // BULK (admin only) — disable/enable or change role
  app.patch("/users/bulk", { preHandler: [requireAdmin] }, async (req) => {
    const body = req.body as any;
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    const updates: any = {};
    if (typeof body.disabled === "boolean") updates.disabled = body.disabled;
    if (body.role) updates.role = body.role;

    const result = await User.updateMany({ _id: { $in: ids } }, { $set: updates });
    // mongoose 8 uses matchedCount/modifiedCount, older shows n/nModified — handle both
    const matched = (result as any).matchedCount ?? (result as any).n ?? 0;
    const modified = (result as any).modifiedCount ?? (result as any).nModified ?? 0;

    return { ids, matched, modified };
  });
}
