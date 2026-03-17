import { randomBytes } from "crypto";

export function generateProofToken(): string {
  return randomBytes(16).toString("hex"); // 32 hex chars = 128 bits
}

export function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit PIN
}
