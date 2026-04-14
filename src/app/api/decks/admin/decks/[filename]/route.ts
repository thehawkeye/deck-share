import { NextRequest, NextResponse } from "next/server";

import { requireAdminSessionOrThrow } from "@/lib/auth";
import { deleteManifest, getManifest, saveManifest } from "@/lib/manifests";

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

  const body = (await request.json().catch(() => null)) as { title?: string } | null;
  const title = body?.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }

  manifest.title = title;
  await saveManifest(filename, manifest);
  return NextResponse.json({ manifest });
}
