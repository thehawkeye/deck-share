import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { createAdminSessionId } from "@/lib/token";
import { kvGetJson, kvSetJson, kvDelete } from "@/lib/kv";

const ADMIN_COOKIE_NAME = "admin_session";
const DECK_COOKIE_PREFIX = "deck_access_";
const ADMIN_SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const DECK_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export interface AdminSessionRecord {
  createdAt: string;
  expiresAt: string;
}

export async function createAdminSessionCookie(adminToken: string): Promise<string> {
  const now = Date.now();
  const timestamp = String(now);
  const encoded = Buffer.from(`${adminToken}:${timestamp}`).toString("base64url");
  const sessionId = createAdminSessionId();
  const session: AdminSessionRecord = {
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ADMIN_SESSION_MAX_AGE * 1000).toISOString(),
  };
  await kvSetJson(`admin:session:${sessionId}`, session);
  return `${encoded}.${sessionId}`;
}

export async function validateAdminSessionCookie(raw: string | undefined): Promise<boolean> {
  if (!raw) return false;
  const [encoded, sessionId] = raw.split(".");
  if (!encoded || !sessionId) return false;
  const decoded = Buffer.from(encoded, "base64url").toString("utf8");
  const [token, ts] = decoded.split(":");
  if (!token || !ts) return false;
  const expected = process.env.DECKS_ADMIN_TOKEN ?? "";
  if (!timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return false;
  const issuedAt = Number(ts);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > ADMIN_SESSION_MAX_AGE * 1000) return false;
  const session = await kvGetJson<AdminSessionRecord>(`admin:session:${sessionId}`);
  if (!session) return false;
  if (new Date(session.expiresAt).getTime() < Date.now()) return false;
  return true;
}

export async function hasValidAdminSession(): Promise<boolean> {
  const store = await cookies();
  return validateAdminSessionCookie(store.get(ADMIN_COOKIE_NAME)?.value);
}

export async function deleteAdminSession(raw: string): Promise<void> {
  const [, sessionId] = raw.split(".");
  if (sessionId) await kvDelete(`admin:session:${sessionId}`);
}

export async function requireAdminSessionOrThrow(): Promise<void> {
  const store = await cookies();
  const raw = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!(await validateAdminSessionCookie(raw))) {
    throw new Error("Unauthorized");
  }
}

export function deckAccessCookieName(filename: string): string {
  return `${DECK_COOKIE_PREFIX}${encodeURIComponent(filename)}`;
}

export function deckAccessCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export function encodeDeckAccessCookie(email: string): string {
  return Buffer.from(email).toString("base64url");
}

export function createDeckAccessCookieValue(email: string): string {
  return encodeDeckAccessCookie(email);
}

export function decodeDeckAccessCookie(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function parseDeckAccessCookieValue(value: string | undefined): string | null {
  if (!value) return null;
  return decodeDeckAccessCookie(value);
}

export function adminCookieName(): string {
  return ADMIN_COOKIE_NAME;
}

export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export { ADMIN_COOKIE_NAME, DECK_SESSION_MAX_AGE };
