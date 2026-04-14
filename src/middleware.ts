import { NextRequest, NextResponse } from "next/server";

interface DeckEmail {
  email: string;
  status: "pending" | "active" | "revoked";
}

interface DeckManifest {
  mode: "locked" | "request" | "open";
  emails: DeckEmail[];
  emailDomains: string[];
  expiresAt: string | null;
}

interface DeckAccessSession {
  filename: string;
  email: string;
  issuedAt: string;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (!pathname.startsWith("/decks/") || pathname === "/decks/gate") {
    return NextResponse.next();
  }

  const filename = decodeURIComponent(pathname.replace("/decks/", ""));
  if (!filename) {
    return NextResponse.next();
  }

  const token = searchParams.get("token");
  if (token) {
    const url = new URL(`/api/decks/${encodeURIComponent(filename)}/token`, request.url);
    url.searchParams.set("token", token);
    return NextResponse.redirect(url);
  }

  const manifest = await getManifest(filename);
  if (!manifest) {
    return gateRedirect(request, filename, "invalid_link");
  }

  if (manifest.expiresAt && new Date(manifest.expiresAt).getTime() < Date.now()) {
    return gateRedirect(request, filename, "deck_expired");
  }

  if (manifest.mode === "open") {
    return NextResponse.next();
  }

  const cookieName = `deck_access_${encodeURIComponent(filename)}`;
  const rawCookie = request.cookies.get(cookieName)?.value;
  const session = await parseDeckAccessCookieValue(rawCookie);

  if (!session || session.filename !== filename) {
    return gateRedirect(request, filename, "invalid_link");
  }

  if (!isEmailAllowed(manifest, session.email)) {
    return gateRedirect(request, filename, "access_revoked");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/decks/:path*"],
};

async function getManifest(filename: string): Promise<DeckManifest | null> {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return null;
  }

  const key = `deck:${filename}:manifest`;
  // Upstash uses command-based POST to the root URL
  const response = await fetch(kvUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["GET", key]),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as unknown[];
  // Upstash returns [null] or [value] for GET
  if (!Array.isArray(data) || data.length === 0 || data[0] === null) {
    return null;
  }

  const result = data[0];
  if (typeof result !== "string") {
    return null;
  }

  try {
    return JSON.parse(result) as DeckManifest;
  } catch {
    return null;
  }
}

function gateRedirect(request: NextRequest, filename: string, error: string): NextResponse {
  const target = new URL("/decks/gate", request.url);
  target.searchParams.set("file", filename);
  target.searchParams.set("error", error);
  return NextResponse.redirect(target);
}

async function parseDeckAccessCookieValue(value: string | undefined): Promise<DeckAccessSession | null> {
  if (!value) return null;
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSig = await signWithSecret(encodedPayload);
  if (!safeEqual(signature, expectedSig)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as DeckAccessSession;
    if (!payload.filename || !payload.email || !payload.issuedAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function signWithSecret(payload: string): Promise<string> {
  const secret = process.env.ADMIN_COOKIE_SECRET;
  if (!secret) return "";

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(signature);
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

function isEmailAllowed(manifest: DeckManifest, email: string): boolean {
  const normalized = email.toLowerCase().trim();
  const found = manifest.emails.find((entry) => entry.email.toLowerCase() === normalized);
  if (found) {
    return found.status !== "revoked";
  }

  const domain = normalized.split("@")[1];
  if (!domain) {
    return false;
  }

  return manifest.emailDomains.some((item) => item.toLowerCase() === domain);
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
}
