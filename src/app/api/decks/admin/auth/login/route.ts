import { NextRequest, NextResponse } from "next/server";

import {
  adminCookieName,
  adminCookieOptions,
  createAdminSessionCookie,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const provided = body?.token?.trim();
  const expected = process.env.DECKS_ADMIN_TOKEN;

  if (!provided || !expected || provided !== expected) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName(), await createAdminSessionCookie(provided), adminCookieOptions());
  return response;
}
