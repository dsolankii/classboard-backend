# Classboard Backend

Fast, typed API for **Classboard** using **Fastify + TypeScript + MongoDB (Mongoose)** with JWT auth and structured logging.

---

## ✨ What you get

* **Auth**: register, login, current user (`/me`)
* **Users**: list with filters (role, date range, search), CRUD, bulk disable/role
* **Suggestions**: quick global search (`/users/suggestions`)
* **Metrics**: dashboard summary + signups time series
* **Roles**: `admin` / `teacher` / `student` enforced on the server
* **Pino logs** & health probe (`/health`)

---

## 🧱 Tech Stack

* **Runtime:** Node.js 20+
* **Framework:** Fastify
* **Language:** TypeScript
* **DB:** MongoDB 6+/8+ (Mongoose v8)
* **Validation:** Zod
* **Auth:** JWT (HTTP `Authorization: Bearer <token>`)

> Frontend (Next.js) uses an HTTP‑only cookie to store the JWT and simply forwards it to this API.

---

## 📦 Project Structure (high‑level)

```
src/
  models/        # Mongoose schemas (User, ...)
  routes/        # Fastify route files (auth, users, metrics)
  utils/         # authGuard, dates, password helpers, etc.
  server.ts      # Fastify bootstrap
```

---

## 🚀 Quick Start (Local)

### 1) Requirements

* **Node 20+**
* **MongoDB** running locally (default URL: `mongodb://localhost:27017`)

### 2) Install dependencies

```bash
npm i
```

### 3) Configure environment

Create **`.env`** in the project root (see also [`.env.example`](./.env.example)):

```env
MONGO_URL=mongodb://localhost:27017/classboard
JWT_SECRET=change-me-to-a-long-random-string
PORT=4000
CORS_ORIGIN=http://localhost:3000
BCRYPT_SALT_ROUNDS=10
```

### 4) Start in dev

```bash
npm run dev
```

If it works you should see logs like:

```
MongoDB connected
Server running on http://localhost:4000
```

### 5) Seed an admin (optional)

```bash
npm run seed
```

**Admin credentials** (after seeding):

* Email: `admin@classboard.local`
* Password: `Admin@123`

> If you don’t seed, register any user and promote their `role` to `"admin"` in MongoDB Compass: DB `classboard` → Collection `users` → edit document.

---

## 🔐 Auth Flow

* Client **logs in** via `POST /auth/login` and receives a JWT `{ token }`.
* Subsequent requests include a header: `Authorization: Bearer <token>`.
* `GET /me` returns the current user.

> The Next.js frontend stores the JWT in an **HTTP‑only cookie** and calls this API through its own `/api/*` route handlers.

---

## 🛣️ API Reference (Core)

All endpoints are prefixed from the server root (e.g., `http://localhost:4000`).

### Health

* `GET /health` → `{ ok: true }`

### Auth

* `POST /auth/register`

  * Body: `{ name: string, email: string, password: string }`
  * Notes: server assigns `role = "student"` unless you add a whitelist/invite feature.
  * Returns: `{ token, user }`

* `POST /auth/login`

  * Body: `{ email: string, password: string }`
  * Returns: `{ token, user }`

* `GET /me`

  * Header: `Authorization: Bearer <token>`
  * Returns: user JSON (sans passwordHash)

### Users

* `GET /users`

  * Query params:

    * `role` — `admin|teacher|student|all` (default `all`)
    * `q` — keyword
    * `scope` — `name|email|all` (default `all`)
    * `mode` — `contains|startsWith` (default `contains`)
    * `start` — ISO timestamp (UTC) — filter by `createdAt ≥ start`
    * `end` — ISO timestamp (UTC) — filter by `createdAt ≤ end`
    * `page` — page number (default `1`)
    * `limit` — items per page (default `10`, max `50`)
    * `sort` — `field:dir` (default `createdAt:desc`)
  * Returns: `{ data: User[], page: number, total: number }`

* `GET /users/:id`

  * Returns the user by id (no password hash)

* `POST /users` **(admin only)**

  * Body: `{ name, email, password, role, bio?, avatarUrl? }`
  * Creates a new user

* `PATCH /users/:id` **(admin or self‑limited)**

  * Admin may update any allowed field.
  * Non‑admin may only update: `name`, `bio`, `avatarUrl`, `preferences`.

* `DELETE /users/:id` **(admin only)**

* `PATCH /users/bulk` **(admin only)**

  * Body examples:

    * `{ ids: ["..."], disabled: true }`
    * `{ ids: ["..."], role: "teacher" }`
  * Returns: `{ ids, matched, modified }`

* `GET /users/suggestions`

  * Query: `q`, `limit` (default `8`)
  * Returns simple array of `{ id, name, email, role }`

### Metrics

* `GET /metrics/summary`

  * Returns totals & deltas for dashboard KPI cards

* `GET /metrics/signups?start=...&end=...&interval=day`

  * Returns: `[{ date: "yyyy/mm/dd", count: number }, ...]`
  * Date bucketing is **UTC**.

---

## 🗂️ Data Model — `User`

```ts
{
  _id: ObjectId,
  name: string,
  email: string,            // unique, lower‑cased
  role: "admin" | "teacher" | "student",
  bio?: string,
  avatarUrl?: string,
  disabled?: boolean,
  preferences?: {
    theme?: "system" | "light" | "dark",
    density?: "comfortable" | "compact",
    language?: string
  },
  createdAt: ISOString,
  updatedAt: ISOString,
  passwordHash: string      // stored only in DB, never returned
}
```

**Indexes**

* `email` unique
* `createdAt` index (for sort/range queries)
* Optional: `role` index

---

## 🧪 Quick cURL Tests

```bash
# 1) Login (admin)
curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@classboard.local","password":"Admin@123"}'

# 2) List users whose *name starts with* "a"
curl -s "http://localhost:4000/users?q=a&scope=name&mode=startsWith&role=all" \
  -H "Authorization: Bearer <TOKEN>"

# 3) Create a user (admin only)
curl -s -X POST http://localhost:4000/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"name":"Alice","email":"alice@example.com","password":"Password@123","role":"student"}'
```

---

## 🧰 Scripts

* `npm run dev` — start Fastify with tsx (watch mode)
* `npm run build` — compile TypeScript to `dist/`
* `npm run start` — run compiled build
* `npm run seed` — create default admin user

---

## 🔒 Security Notes

* Use a long random `JWT_SECRET` in production
* Keep HTTPS at the proxy; restrict CORS with `CORS_ORIGIN`
* All admin actions validated server‑side (never trust client role)
* Passwords stored as `bcrypt` hashes

---

## 🩹 Troubleshooting

* **401 Unauthorized** on `/me` or `/users`: missing/expired token → login again
* **CORS error** from browser: set `CORS_ORIGIN=http://localhost:3000` (or your frontend origin)
* **Mongo connection fails**: check `MONGO_URL` and ensure `mongod` is running
* **409 Email already in use**: the email exists; use a different one

---

## 📦 Deploy (simple self‑host)

1. Build: `npm run build`
2. Provide production `.env`
3. Start: `npm run start` (or run under PM2/systemd)
4. Put a reverse proxy (Nginx/Caddy) in front with HTTPS. Allow only your frontend origin via CORS.

---

## 🗺️ Roadmap (nice‑to‑have)

* **Email whitelist / invites** to auto‑assign roles on signup
* Audit log for admin actions
* Rate‑limit & IP throttling
* E2E & unit tests (Vitest)

---

## 📜 License

MIT (or your preference)
