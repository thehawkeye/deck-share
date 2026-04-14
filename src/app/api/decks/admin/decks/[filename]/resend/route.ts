import { NextRequest, NextResponse } from "next/server";

import { adminOrThrow as adminOrThrow } from "@/lib/auth";
import { issueMagicLink } from "@/lib/manifests";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await adminOrThrow(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = await context.params;
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim();

  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  try {
    await issueMagicLink({ filename, email });
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: "email_not_allowed" }, { status: 400 });
  }
}
