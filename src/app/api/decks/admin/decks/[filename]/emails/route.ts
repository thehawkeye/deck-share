import { NextRequest, NextResponse } from "next/server";

import { requireAdminSessionOrThrow } from "@/lib/auth";
import {
  addEmailsToManifest,
  issueMagicLink,
  normalizeEmail,
  removeEmailsFromManifest,
  setEmailStatus,
} from "@/lib/manifests";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await requireAdminSessionOrThrow();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { emails?: string[]; addedBy?: string }
    | null;

  const incoming = body?.emails ?? [];
  if (!incoming.length) {
    return NextResponse.json({ error: "emails_required" }, { status: 400 });
  }

  const { added, alreadyExists } = await addEmailsToManifest({
    filename,
    emails: incoming,
    addedBy: normalizeEmail(body?.addedBy ?? "muralikrishnan@gmail.com"),
  });

  for (const email of added) {
    await issueMagicLink({ filename, email });
  }

  return NextResponse.json({ added, alreadyExists });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await requireAdminSessionOrThrow();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = await context.params;
  const body = (await request.json().catch(() => null)) as { emails?: string[] } | null;
  const incoming = body?.emails ?? [];
  if (!incoming.length) {
    return NextResponse.json({ error: "emails_required" }, { status: 400 });
  }

  const { removed } = await removeEmailsFromManifest({ filename, emails: incoming });
  return NextResponse.json({ removed });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    await requireAdminSessionOrThrow();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { email?: string; status?: "pending" | "active" | "revoked" }
    | null;
  const email = normalizeEmail(body?.email ?? "");
  const status = body?.status;

  if (!email || !status) {
    return NextResponse.json({ error: "email_and_status_required" }, { status: 400 });
  }

  try {
    const manifest = await setEmailStatus({ filename, email, status });
    return NextResponse.json({ manifest });
  } catch {
    return NextResponse.json({ error: "email_not_found" }, { status: 404 });
  }
}
