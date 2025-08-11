// src/config/env.ts
import 'dotenv/config';

function need(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUrl: need('MONGO_URL', 'mongodb://localhost:27017/classboard'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
};
