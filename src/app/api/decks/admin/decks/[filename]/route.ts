import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { deleteManifest, getManifest, ensureManifest, saveManifest } from "@/lib/manifests";

const ADMIN_COOKIE_NAME = "admin_session";
const ADMIN_SESSION_MAX_AGE = 7 * 24 * 60 * 60;

async function validateAdmin(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!raw) return false;
  const [encoded] = raw.split(".");
  if (!encoded) return false;
  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    const [token, ts] = decoded.split(":");
    if (!token || !ts) return false;
    const expected = process.env.DECKS_ADMIN_TOKEN ?? "";
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return false;
    const issuedAt = Number(ts);
    if (!Number.isFinite(issuedAt)) return false;
    if (Date.now() - issuedAt > ADMIN_SESSION_MAX_AGE * 1000) return false;
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

async function adminOrThrow(request: NextRequest): Promise<void> {
  if (hasBearerToken(request)) return;
  if (!(await validateAdmin())) {
    throw new Error("Unauthorized");
  }
}

// ─── PUT: Create or update manifest ───────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await adminOrThrow(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    mode?: "locked" | "request" | "open";
    sharingEnabled?: boolean;
    expiresAt?: string | null;
  } | null;

  if (!body?.title?.trim()) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }

  const manifest = await ensureManifest(filename, body.title.trim());
  if (body.mode) manifest.mode = body.mode;
  if (typeof body.sharingEnabled === "boolean") manifest.sharingEnabled = body.sharingEnabled;
  if (body.expiresAt !== undefined) manifest.expiresAt = body.expiresAt;
  await saveManifest(filename, manifest);

  return NextResponse.json({ manifest });
}

// ─── GET: Fetch manifest ──────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await adminOrThrow(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = await context.params;
  const manifest = await getManifest(filename);
  if (!manifest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ manifest });
}

// ─── DELETE: Remove manifest ──────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await adminOrThrow(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = await context.params;
  await deleteManifest(filename);
  return NextResponse.json({ deleted: true });
}

// ─── PATCH: Partial update ────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await adminOrThrow(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = await context.params;
  const manifest = await getManifest(filename);
  if (!manifest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    mode?: "locked" | "request" | "open";
    sharingEnabled?: boolean;
    expiresAt?: string | null;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body.title) manifest.title = body.title.trim();
  if (body.mode) manifest.mode = body.mode;
  if (typeof body.sharingEnabled === "boolean") manifest.sharingEnabled = body.sharingEnabled;
  if (body.expiresAt !== undefined) manifest.expiresAt = body.expiresAt;

  await saveManifest(filename, manifest);
  return NextResponse.json({ manifest });
}
