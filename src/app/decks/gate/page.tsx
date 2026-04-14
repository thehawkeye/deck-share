import Link from "next/link";

import { getManifest } from "@/lib/manifests";

import styles from "./page.module.css";

const errorMap: Record<string, { title: string; detail: string }> = {
  invalid_link: {
    title: "Invalid link",
    detail: "This access link is not valid for the requested deck.",
  },
  link_used: {
    title: "Link already used",
    detail: "Magic links are single-use. Request a new one from the owner.",
  },
  link_expired: {
    title: "Link expired",
    detail: "This magic link expired before it was opened.",
  },
  access_revoked: {
    title: "Access revoked",
    detail: "Your email is no longer authorized to view this deck.",
  },
  deck_expired: {
    title: "Deck expired",
    detail: "The owner set this deck to expire and the expiry window has passed.",
  },
};

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ file?: string; error?: string }>;
}) {
  const { file, error } = await searchParams;
  const filename = file ?? "unknown-deck";

  let title = filename;
  if (file) {
    const manifest = await getManifest(file);
    if (manifest?.title) {
      title = manifest.title;
    }
  }

  const resolved = errorMap[error ?? ""] ?? errorMap.invalid_link;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Deck Access Restricted</p>
        <h1>{title}</h1>
        <p className={styles.filename}>{filename}</p>

        <div className={styles.errorBlock}>
          <h2>{resolved.title}</h2>
          <p>{resolved.detail}</p>
          <p className={styles.code}>Code: {error ?? "invalid_link"}</p>
        </div>

        <Link href="mailto:muralikrishnan@gmail.com" className={styles.contact}>
          Contact deck owner
        </Link>
      </section>
    </main>
  );
}
