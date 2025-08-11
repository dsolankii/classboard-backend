import { FastifyInstance } from "fastify";
import { requireAuth } from "../utils/authGuard";
import { User } from "../models/User";
import { parseDateOrNull, previousWindow, pct } from "../utils/dates";

/**
 * Summary rules (to match your UI):
 * - totalUsers / totalTeachers / totalStudents = ALL-TIME totals
 * - weeklySignups = signups in the selected window (defaults to last 7 days)
 * - deltas.* = % change of signups in THIS window vs the PREVIOUS equal window
 *   (users delta = total signups this window vs previous window; teachers/students same idea)
 */
export async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics/summary", { preHandler: [requireAuth] }, async (req) => {
    const q = req.query as any;
    // default window: last 7 days
    const end = parseDateOrNull(q.end) ?? new Date();
    const start = parseDateOrNull(q.start) ?? new Date(end.getTime() - 7 * 24 * 3600 * 1000);

    // all-time totals for headline numbers
    const [totalUsers, totalTeachers, totalStudents] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "teacher" }),
      User.countDocuments({ role: "student" }),
    ]);

    // counts inside current window
    const [windowAll, windowTeachers, windowStudents] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      User.countDocuments({ role: "teacher", createdAt: { $gte: start, $lte: end } }),
      User.countDocuments({ role: "student", createdAt: { $gte: start, $lte: end } }),
    ]);

    // counts in previous equal window (for % delta)
    const { prevStart, prevEnd } = previousWindow(start, end);
    const [prevAll, prevTeachers, prevStudents] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: prevStart, $lte: prevEnd } }),
      User.countDocuments({ role: "teacher", createdAt: { $gte: prevStart, $lte: prevEnd } }),
      User.countDocuments({ role: "student", createdAt: { $gte: prevStart, $lte: prevEnd } }),
    ]);

    return {
      totalUsers,
      totalTeachers,
      totalStudents,
      weeklySignups: windowAll,
      deltas: {
        users: pct(windowAll, prevAll),
        teachers: pct(windowTeachers, prevTeachers),
        students: pct(windowStudents, prevStudents),
        weeklySignups: pct(windowAll, prevAll),
      },
    };
  });

  app.get("/metrics/signups", { preHandler: [requireAuth] }, async (req) => {
    const q = req.query as any;
    const interval = (q.interval as string) || "day"; // only "day" supported
    const end = parseDateOrNull(q.end) ?? new Date();
    const start = parseDateOrNull(q.start) ?? new Date(end.getTime() - 7 * 24 * 3600 * 1000);

    if (interval !== "day") {
      return []; // keep it simple for now
    }

    // Group signups by UTC day: { date: "YYYY-MM-DD", count }
    const rows = await User.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", count: 1 } },
    ]);

    return rows;
  });
}
