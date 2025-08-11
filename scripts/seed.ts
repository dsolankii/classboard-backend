// scripts/seed.ts
import { faker } from "@faker-js/faker/locale/en";
import mongoose from "mongoose";
import "dotenv/config";
import { User } from "../src/models/User";
import { hashPassword } from "../src/utils/password";

function pickRole() {
  const r = Math.random();
  if (r < 0.15) return "teacher";  // ~15%
  return "student";                 // ~85%
}

async function main() {
  const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/classboard";
  await mongoose.connect(mongoUrl);

  // wipe existing users (safe for local dev)
  await User.deleteMany({});

  // 1) one admin you can log in with
  const admin = await User.create({
    name: "Admin User",
    email: "admin@classboard.local",
    role: "admin",
    passwordHash: await hashPassword("Admin@123"),
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
    updatedAt: new Date(),
  });

  // 2) ~250 random users over last 90 days
  const docs: any[] = [];
  for (let i = 0; i < 250; i++) {
    const role = pickRole();
    const daysAgo = Math.floor(Math.random() * 90);
    const msOffset = Math.floor(Math.random() * 86400000);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000 - msOffset);

    docs.push({
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      role,
      bio: faker.lorem.sentence({ min: 6, max: 12 }),
      passwordHash: await hashPassword("Password@123"),
      createdAt,
      updatedAt: createdAt,
    });
  }
  await User.insertMany(docs);

  console.log("Seed complete ✅");
  console.log("Admin login → email: admin@classboard.local  password: Admin@123");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
