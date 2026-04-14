import { NextRequest, NextResponse } from "next/server";

import { requireAdminSessionOrThrow } from "@/lib/auth";
import { deleteManifest, getManifest, ensureManifest, saveManifest } from "@/lib/manifests";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await requireAdminSessionOrThrow();
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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await requireAdminSessionOrThrow();
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

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await requireAdminSessionOrThrow();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = await context.params;
  await deleteManifest(filename);
  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await requireAdminSessionOrThrow();
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
