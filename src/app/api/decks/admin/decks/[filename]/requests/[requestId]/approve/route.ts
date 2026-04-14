import { NextRequest, NextResponse } from "next/server";

import { adminOrThrow as adminOrThrow } from "@/lib/auth";
import {
  addEmailsToManifest,
  getRequest,
  issueMagicLink,
  updateRequestStatus,
} from "@/lib/manifests";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ filename: string; requestId: string }> },
) {
  try {
    await adminOrThrow(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename, requestId } = await context.params;
  const requestRecord = await getRequest(filename, requestId);
  if (!requestRecord) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (requestRecord.status !== "pending") {
    return NextResponse.json({ ok: true });
  }

  await addEmailsToManifest({
    filename,
    emails: [requestRecord.requestedEmail],
    addedBy: requestRecord.fromEmail,
  });
  await issueMagicLink({ filename, email: requestRecord.requestedEmail });
  await updateRequestStatus({ filename, requestId, status: "approved" });

  return NextResponse.json({ ok: true });
}
