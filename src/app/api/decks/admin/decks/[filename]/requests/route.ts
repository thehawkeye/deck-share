import { NextRequest, NextResponse } from "next/server";

import {
  adminOrThrow as adminOrThrow,
  parseDeckAccessCookieValue,
  deckAccessCookieName,
} from "@/lib/auth";
import { createRequest, listRequests, normalizeEmail } from "@/lib/manifests";

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
  const requests = await listRequests(filename);
  return NextResponse.json({ requests: requests.filter((entry) => entry.status === "pending") });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;

  const cookie = request.cookies.get(deckAccessCookieName(filename))?.value;
  const sessionEmail = parseDeckAccessCookieValue(cookie);
  const requestedByOwner = request.nextUrl.searchParams.get("owner") === "true";
  if (requestedByOwner) {
    try {
      await adminOrThrow(request);
    } catch {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const requester = requestedByOwner ? "muralikrishnan@gmail.com" : sessionEmail;
  if (!requester) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { requestedEmail?: string } | null;
  const requestedEmail = normalizeEmail(body?.requestedEmail ?? "");
  if (!requestedEmail || !requestedEmail.includes("@")) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const created = await createRequest({
    filename,
    fromEmail: requester,
    requestedEmail,
  });

  return NextResponse.json({ request: created });
}
