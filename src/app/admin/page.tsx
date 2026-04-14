import { redirect } from "next/navigation";

import { hasValidAdminSession } from "@/lib/auth";
import { listDecks } from "@/lib/manifests";

import { LogoutButton } from "./logout-button";
import styles from "./page.module.css";

export default async function AdminDashboardPage() {
  let isLoggedIn = false;
  try {
    isLoggedIn = await hasValidAdminSession();
  } catch (e) {
    console.error("Session check failed:", e);
    isLoggedIn = false;
  }

  if (!isLoggedIn) {
    redirect("/admin/login");
  }

  let decks: { filename: string; manifest: { title: string; mode: string; sharingEnabled: boolean; expiresAt: string | null; emails: { email: string; status: string }[] } }[] = [];
  try {
    decks = await listDecks();
  } catch (e) {
    console.error("listDecks failed:", e);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin</p>
          <h1>Deck Share</h1>
        </div>
        <LogoutButton />
      </header>

      <section className={styles.stats}>
        <article>
          <p>Total Decks</p>
          <strong>{decks.length}</strong>
        </article>
        <article>
          <p>Total Users</p>
          <strong>0</strong>
        </article>
        <article>
          <p>Pending Requests</p>
          <strong>0</strong>
        </article>
      </section>

      <section className={styles.tableWrap}>
        {decks.length === 0 ? (
          <p className={styles.empty}>No decks found yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Filename</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {decks.map((deck) => (
                <tr key={deck.filename}>
                  <td>{deck.manifest.title}</td>
                  <td className={styles.filename}>{deck.filename}</td>
                  <td>
                    <a href={`/decks/${encodeURIComponent(deck.filename)}`} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
