import { NextRequest, NextResponse } from "next/server";

import { adminOrThrow as adminOrThrow } from "@/lib/auth";
import { ensureManifest, listDecks } from "@/lib/manifests";

export async function GET() {
  try {
    await adminOrThrow(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const decks = await listDecks();
  return NextResponse.json({ decks });
}

export async function PUT(request: NextRequest) {
  try {
    await adminOrThrow(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { filename?: string; title?: string } | null;
  const filename = body?.filename?.trim();
  if (!filename) {
    return NextResponse.json({ error: "filename_required" }, { status: 400 });
  }

  const manifest = await ensureManifest(filename, body?.title);
  return NextResponse.json({ manifest });
}
