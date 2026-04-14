import Link from "next/link";
import { redirect } from "next/navigation";

import { hasValidAdminSession } from "@/lib/auth";
import { getManifest, listRequests } from "@/lib/manifests";

import { DeckEditorClient } from "./deck-editor-client";
import styles from "./page.module.css";

export default async function AdminDeckPage({
  params,
}: {
  params: Promise<{ filename: string }>;
}) {
  if (!(await hasValidAdminSession())) {
    redirect("/admin/login");
  }

  const { filename } = await params;
  const manifest = await getManifest(filename);
  if (!manifest) {
    redirect("/admin");
  }

  const requests = (await listRequests(filename)).filter((entry) => entry.status === "pending");

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/admin">
        Back to dashboard
      </Link>
      <DeckEditorClient filename={filename} initialManifest={manifest} initialRequests={requests} />
    </main>
  );
}
