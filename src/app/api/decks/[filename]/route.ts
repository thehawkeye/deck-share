import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { parseDeckAccessCookieValue, deckAccessCookieName } from "@/lib/auth";
import { getManifest, isDeckExpired, isEmailAllowed } from "@/lib/manifests";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  const manifest = await getManifest(filename);

  if (!manifest) {
    return gateRedirect(request, filename, "invalid_link");
  }

  if (isDeckExpired(manifest.expiresAt)) {
    return gateRedirect(request, filename, "deck_expired");
  }

  const cookieValue = request.cookies.get(deckAccessCookieName(filename))?.value;
  const access = parseDeckAccessCookieValue(cookieValue);

  const canOpen =
    manifest.mode === "open" ||
    (access && access.filename === filename && isEmailAllowed(manifest, access.email));

  if (!canOpen) {
    return gateRedirect(request, filename, "invalid_link");
  }

  const filePath = path.join(process.cwd(), "public", "static", filename);
  try {
    const html = await readFile(filePath, "utf8");
    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Deck file not found", { status: 404 });
  }
}

function gateRedirect(request: NextRequest, filename: string, error: string): NextResponse {
  const target = new URL("/decks/gate", request.url);
  target.searchParams.set("file", filename);
  target.searchParams.set("error", error);
  return NextResponse.redirect(target);
}
