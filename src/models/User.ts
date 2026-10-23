import mongoose, { Schema, type Model } from "mongoose";

export interface UserRecord {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const schema = new Schema<UserRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export default (mongoose.models.User as Model<UserRecord> | undefined) ??
  mongoose.model<UserRecord>("User", schema);
