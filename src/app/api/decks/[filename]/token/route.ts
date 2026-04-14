import { NextRequest, NextResponse } from "next/server";

import {
  createDeckAccessCookieValue,
  deckAccessCookieName,
  deckAccessCookieOptions,
} from "@/lib/auth";
import {
  consumeAccessToken,
  getAccessToken,
  isDeckExpired,
  markEmailActive,
  getManifest,
  isEmailAllowed,
} from "@/lib/manifests";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return gateRedirect(request, filename, "invalid_link");
  }

  const stored = await getAccessToken(token);
  if (!stored || stored.filename !== filename) {
    return gateRedirect(request, filename, "invalid_link");
  }

  if (stored.used) {
    return gateRedirect(request, filename, "link_used");
  }

  if (new Date(stored.expiresAt).getTime() < Date.now()) {
    await consumeAccessToken(token);
    return gateRedirect(request, filename, "link_expired");
  }

  const manifest = await getManifest(filename);
  if (!manifest) {
    return gateRedirect(request, filename, "invalid_link");
  }

  if (isDeckExpired(manifest.expiresAt)) {
    return gateRedirect(request, filename, "deck_expired");
  }

  if (!isEmailAllowed(manifest, stored.email)) {
    await consumeAccessToken(token);
    return gateRedirect(request, filename, "access_revoked");
  }

  await consumeAccessToken(token);
  await markEmailActive(filename, stored.email);

  const response = NextResponse.redirect(new URL(`/decks/${encodeURIComponent(filename)}`, request.url));
  response.cookies.set(
    deckAccessCookieName(filename),
    createDeckAccessCookieValue(stored.email),
    deckAccessCookieOptions(),
  );

  return response;
}

function gateRedirect(request: NextRequest, filename: string, error: string): NextResponse {
  const target = new URL("/decks/gate", request.url);
  target.searchParams.set("file", filename);
  target.searchParams.set("error", error);
  return NextResponse.redirect(target);
}
