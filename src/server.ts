// src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import mongoose from 'mongoose';
import { config } from './config/env';
import { authRoutes } from "./routes/auth"; 
import { meRoutes } from "./routes/me";
import { usersRoutes } from "./routes/users";
import { metricsRoutes } from "./routes/metrics";


async function start() {
  const app = Fastify({ logger: true });

  // security & basics
  await app.register(cors, { origin: config.corsOrigin, credentials: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  // connect DB
  try {
    await mongoose.connect(config.mongoUrl);
    app.log.info('MongoDB connected');
  } catch (err) {
    app.log.error({ err }, 'MongoDB connection failed');
    process.exit(1);
  }

  // tiny health route
  app.get("/health", async () => ({ ok: true, env: config.env, mongo: "connected" }));

  await app.register(meRoutes);

    // REGISTER ROUTES
  await app.register(authRoutes); // <-- add this

  await app.register(usersRoutes);

  await app.register(metricsRoutes);

  // start server
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Server running on http://localhost:${config.port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
