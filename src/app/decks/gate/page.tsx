import Link from "next/link";

import styles from "./page.module.css";

const errors: Record<string, string> = {
  invalid_link: "This link is invalid.",
  link_used: "This link has already been used.",
  link_expired: "This link has expired.",
  access_revoked: "Your access has been revoked.",
  deck_expired: "This deck has expired.",
};

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ file?: string; error?: string }>;
}) {
  const { file, error } = await searchParams;
  const message = errors[error ?? ""] ?? errors.invalid_link;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Deck Access</p>
        <h1>{file ?? "Unknown deck"}</h1>
        <p className={styles.error}>{message}</p>
        <Link href="mailto:muralikrishnan@gmail.com">Contact the deck owner</Link>
      </section>
    </main>
  );
}
