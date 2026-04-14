import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { deckAccessCookieName, parseDeckAccessCookieValue } from "@/lib/auth";
import { getManifest } from "@/lib/manifests";

import { DeckViewerClient } from "./viewer-client";

export default async function DeckViewerPage({
  params,
}: {
  params: Promise<{ filename: string }>;
}) {
  const { filename } = await params;
  const manifest = await getManifest(filename);

  if (!manifest) {
    redirect(`/decks/gate?file=${encodeURIComponent(filename)}&error=invalid_link`);
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(deckAccessCookieName(filename))?.value;
  const access = parseDeckAccessCookieValue(cookieValue);

  return (
    <DeckViewerClient
      filename={filename}
      title={manifest.title}
      email={access?.email ?? "Guest"}
      sharingEnabled={manifest.sharingEnabled}
    />
  );
}
