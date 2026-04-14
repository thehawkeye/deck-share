import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminSessionId } from "@/lib/token";
import { kvGetJson, kvSetJson } from "@/lib/kv";

const ADMIN_COOKIE_NAME = "admin_session";
const ADMIN_SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const DECK_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export interface AdminSessionRecord {
  createdAt: string;
  expiresAt: string;
}

async function validateAdminCookie(raw: string | undefined): Promise<boolean> {
  if (!raw) return false;
  const [encoded, sessionId] = raw.split(".");
  if (!encoded || !sessionId) return false;
  try {
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
  } catch {
    return false;
  }
}

function hasBearerToken(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7).trim();
  const expected = process.env.DECKS_ADMIN_TOKEN ?? "";
  return provided === expected;
}

export async function adminOrThrow(request?: NextRequest): Promise<void> {
  if (request && hasBearerToken(request)) return;
  const store = await cookies();
  if (!(await validateAdminCookie(store.get(ADMIN_COOKIE_NAME)?.value))) {
    throw new Error("Unauthorized");
  }
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

export async function hasValidAdminSession(): Promise<boolean> {
  const store = await cookies();
  return validateAdminCookie(store.get(ADMIN_COOKIE_NAME)?.value);
}

export async function deleteAdminSession(raw: string): Promise<void> {
  const [, sessionId] = raw.split(".");
  if (sessionId) await kvDelete(`admin:session:${sessionId}`);
}

export async function requireAdminSessionOrThrow(): Promise<void> {
  const store = await cookies();
  if (!(await validateAdminCookie(store.get(ADMIN_COOKIE_NAME)?.value))) {
    throw new Error("Unauthorized");
  }
}

export function deckAccessCookieName(filename: string): string {
  return `deck_access_${encodeURIComponent(filename)}`;
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

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  };
}

export { ADMIN_COOKIE_NAME, ADMIN_SESSION_MAX_AGE, DECK_SESSION_MAX_AGE, kvDelete };
