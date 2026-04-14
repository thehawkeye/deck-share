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

  const body = (await request.json().catch(() => null)) as { sharingEnabled?: boolean } | null;
  if (typeof body?.sharingEnabled !== "boolean") {
    return NextResponse.json({ error: "sharing_enabled_required" }, { status: 400 });
  }

  const { filename } = await context.params;
  const manifest = await ensureManifest(filename);
  manifest.sharingEnabled = body.sharingEnabled;
  await saveManifest(filename, manifest);

  return NextResponse.json({ manifest });
}
