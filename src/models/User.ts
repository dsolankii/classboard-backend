import { Schema, model } from "mongoose";

const Preferences = new Schema(
  {
    theme: { type: String, enum: ["system", "light", "dark"], default: "system" },
    density: { type: String, enum: ["comfortable", "compact"], default: "comfortable" },
    language: { type: String, default: "en" },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "teacher", "student"], default: "student", index: true },
    bio: { type: String },
    avatarUrl: { type: String },
    disabled: { type: Boolean, default: false },
    preferences: { type: Preferences, default: () => ({}) },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ createdAt: -1 });

export const User = model("User", UserSchema);
