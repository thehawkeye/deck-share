import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { adminCookieName, deleteAdminSession } from "@/lib/auth";

export async function POST() {
  const store = await cookies();
  const cookieValue = store.get(adminCookieName())?.value;
  await deleteAdminSession(cookieValue);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName(), "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
