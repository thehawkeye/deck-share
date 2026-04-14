import Link from "next/link";
import { redirect } from "next/navigation";

import { hasValidAdminSession } from "@/lib/auth";
import { listDecks } from "@/lib/manifests";

import { LogoutButton } from "./logout-button";
import styles from "./page.module.css";

interface DeckEmail {
  email: string;
  status: string;
  addedAt: string;
}

interface DeckManifest {
  title: string;
  mode: string;
  sharingEnabled: boolean;
  expiresAt: string | null;
  emails: DeckEmail[];
}

interface DeckEntry {
  filename: string;
  manifest: DeckManifest;
}

export default async function AdminDashboardPage() {
  let isLoggedIn = false;
  try {
    isLoggedIn = await hasValidAdminSession();
  } catch {
    isLoggedIn = false;
  }

  if (!isLoggedIn) {
    redirect("/admin/login");
  }

  let decks: DeckEntry[] = [];
  try {
    decks = await listDecks();
  } catch {
    decks = [];
  }

  let pendingByDeck: Map<string, number> = new Map();
  try {
    const pendingResults = await Promise.allSettled(
      decks.map(async (deck) => {
        const { listRequests } = await import("@/lib/manifests");
        const requests = await listRequests(deck.filename);
        return { filename: deck.filename, count: requests.filter((r: { status: string }) => r.status === "pending").length };
      }),
    );
    for (const result of pendingResults) {
      if (result.status === "fulfilled") {
        pendingByDeck.set(result.value.filename, result.value.count);
      }
    }
  } catch {
    // ignore pending counts
  }

  const totalUsers = decks.reduce(
    (sum, deck) => sum + deck.manifest.emails.filter((e: DeckEmail) => e.status !== "revoked").length,
    0,
  );
  const totalPending = Array.from(pendingByDeck.values()).reduce((a, b) => a + b, 0);

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
          <strong>{totalUsers}</strong>
        </article>
        <article>
          <p>Pending Requests</p>
          <strong>{totalPending}</strong>
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
                <th>Mode</th>
                <th>Users</th>
                <th>Sharing</th>
                <th>Pending</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {decks.map((deck) => {
                const manifest = deck.manifest;
                const activeCount = manifest.emails.filter((e: DeckEmail) => e.status === "active").length;
                const pendingCount = manifest.emails.filter((e: DeckEmail) => e.status === "pending").length;

                return (
                  <tr key={deck.filename}>
                    <td>{manifest.title}</td>
                    <td className={styles.filename}>{deck.filename}</td>
                    <td>
                      <span className={styles.badge}>{manifest.mode}</span>
                    </td>
                    <td>
                      {activeCount}/{pendingCount}
                    </td>
                    <td>{manifest.sharingEnabled ? "On" : "Off"}</td>
                    <td>{pendingByDeck.get(deck.filename) ?? 0}</td>
                    <td>
                      <a href={`/decks/${encodeURIComponent(deck.filename)}`} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                      {" · "}
                      <Link href={`/admin/deck/${encodeURIComponent(deck.filename)}`}>Manage</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.upload}>
        <h2>Upload New Deck</h2>
        <p>Add an HTML file to <code>public/static/</code> in the repo, push, then run:</p>
        <pre>
          <code>curl -X PUT https://deck-share.vercel.app/api/decks/admin/decks/your-file.html \
-H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
-d &apos;{"{"}"title":"Your Title"{"}"}&apos;</code>
        </pre>
      </section>
    </main>
  );
}
