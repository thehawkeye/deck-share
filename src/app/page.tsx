import Link from "next/link";

import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.kicker}>Deck Share</p>
        <h1>Private deck access, one magic link at a time.</h1>
        <p className={styles.copy}>
          Use the admin dashboard to manage manifests, recipients, and sharing requests.
        </p>
        <div className={styles.actions}>
          <Link href="/admin">Open Admin</Link>
        </div>
      </div>
    </main>
  );
}
