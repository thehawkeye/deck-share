import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { deckAccessCookieName, parseDeckAccessCookieValue } from "@/lib/auth";
import { getManifest, isEmailAllowed, normalizeEmail } from "@/lib/manifests";

import { DeckViewerClient } from "./viewer-client";

export default async function DeckViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ filename: string }>;
  searchParams: Promise<{ owner_access?: string }>;
}) {
  const { filename } = await params;
  const { owner_access: ownerAccessParam } = await searchParams;
  const ownerAccess = ownerAccessParam === "true";

  const manifest = await getManifest(filename);

  if (!manifest) {
    redirect(`/decks/gate?file=${encodeURIComponent(filename)}&error=invalid_link`);
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(deckAccessCookieName(filename))?.value;
  const recipientEmail = parseDeckAccessCookieValue(cookieValue);

  const normalizedRecipient = recipientEmail ? normalizeEmail(recipientEmail) : null;
  const canShareAsRecipient = normalizedRecipient ? isEmailAllowed(manifest, normalizedRecipient) : false;
  const canShare = manifest.sharingEnabled && (ownerAccess || canShareAsRecipient);

  return (
    <DeckViewerClient
      filename={filename}
      title={manifest.title}
      email={ownerAccess ? "Owner" : recipientEmail ?? "Guest"}
      canShare={canShare}
      ownerAccess={ownerAccess}
    />
  );
}
