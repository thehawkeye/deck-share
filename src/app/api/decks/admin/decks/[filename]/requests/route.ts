import { NextRequest, NextResponse } from "next/server";

import { requireAdminSessionOrThrow, parseDeckAccessCookieValue, deckAccessCookieName } from "@/lib/auth";
import { createRequest, listRequests, normalizeEmail } from "@/lib/manifests";

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
  const requests = await listRequests(filename);
  return NextResponse.json({ requests: requests.filter((entry) => entry.status === "pending") });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;

  const cookie = request.cookies.get(deckAccessCookieName(filename))?.value;
  const session = parseDeckAccessCookieValue(cookie);

  if (!session || session.filename !== filename) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { requestedEmail?: string } | null;
  const requestedEmail = normalizeEmail(body?.requestedEmail ?? "");
  if (!requestedEmail || !requestedEmail.includes("@")) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const created = await createRequest({
    filename,
    fromEmail: session.email,
    requestedEmail,
  });

  return NextResponse.json({ request: created });
}
