import { NextRequest, NextResponse } from "next/server";

import { adminOrThrow as adminOrThrow } from "@/lib/auth";
import { ensureManifest, saveManifest } from "@/lib/manifests";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await adminOrThrow(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { expiresAt?: string | null } | null;
  if (body?.expiresAt !== null && body?.expiresAt !== undefined && Number.isNaN(Date.parse(body.expiresAt))) {
    return NextResponse.json({ error: "invalid_expires_at" }, { status: 400 });
  }

  const { filename } = await context.params;
  const manifest = await ensureManifest(filename);
  manifest.expiresAt = body?.expiresAt ?? null;
  await saveManifest(filename, manifest);

  return NextResponse.json({ manifest });
}
