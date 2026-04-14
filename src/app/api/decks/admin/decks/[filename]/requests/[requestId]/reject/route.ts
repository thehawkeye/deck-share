import { NextRequest, NextResponse } from "next/server";

import { requireAdminSessionOrThrow } from "@/lib/auth";
import { getRequest, updateRequestStatus } from "@/lib/manifests";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ filename: string; requestId: string }> },
) {
  try {
    await requireAdminSessionOrThrow();
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

  await updateRequestStatus({ filename, requestId, status: "rejected" });
  return NextResponse.json({ ok: true });
}
