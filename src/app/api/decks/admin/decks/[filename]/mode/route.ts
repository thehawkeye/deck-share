import { NextRequest, NextResponse } from "next/server";

import { adminOrThrow as adminOrThrow } from "@/lib/auth";
import { DeckMode, ensureManifest, saveManifest } from "@/lib/manifests";

const ALLOWED_MODES: DeckMode[] = ["locked", "request", "open"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await adminOrThrow(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { mode?: DeckMode } | null;
  if (!body?.mode || !ALLOWED_MODES.includes(body.mode)) {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  const { filename } = await context.params;
  const manifest = await ensureManifest(filename);
  manifest.mode = body.mode;
  await saveManifest(filename, manifest);

  return NextResponse.json({ manifest });
}
