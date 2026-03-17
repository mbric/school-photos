// Lightweight JWT verification for Edge runtime (middleware)
// The full auth.ts uses jsonwebtoken which requires Node.js runtime

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

export async function verifyTokenEdge(token: string): Promise<JWTPayload | null> {
  try {
    const secret = process.env.JWT_SECRET || "dev-secret-change-in-production";

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureInput = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signature = Uint8Array.from(
      base64UrlDecode(parts[2]),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify("HMAC", key, signature, signatureInput);
    if (!valid) return null;

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
