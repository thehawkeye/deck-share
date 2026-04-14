import Link from "next/link";
import { redirect } from "next/navigation";

import { hasValidAdminSession } from "@/lib/auth";
import { listDecks, listRequests } from "@/lib/manifests";

import { LogoutButton } from "./logout-button";
import styles from "./page.module.css";

export default async function AdminDashboardPage() {
  if (!(await hasValidAdminSession())) {
    redirect("/admin/login");
  }

  const decks = await listDecks();
  const requestCounts = await Promise.all(
    decks.map(async (deck) => ({
      filename: deck.filename,
      count: (await listRequests(deck.filename)).filter((entry) => entry.status === "pending").length,
    })),
  );

  const pendingByDeck = new Map(requestCounts.map((item) => [item.filename, item.count]));
  const totalUsers = decks.reduce(
    (sum, deck) =>
      sum + deck.manifest.emails.filter((entry) => entry.status !== "revoked").length,
    0,
  );
  const totalPending = requestCounts.reduce((sum, item) => sum + item.count, 0);

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
        {decks.length ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Title</th>
                <th>Mode</th>
                <th>Users</th>
                <th>Expiry</th>
                <th>Sharing</th>
                <th>Pending</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {decks.map(({ filename, manifest }) => {
                const activeCount = manifest.emails.filter((entry) => entry.status === "active").length;
                const pendingCount = manifest.emails.filter((entry) => entry.status === "pending").length;

                return (
                  <tr key={filename}>
                    <td>{filename}</td>
                    <td>{manifest.title}</td>
                    <td>
                      <span className={styles.badge}>{manifest.mode}</span>
                    </td>
                    <td>
                      {activeCount}/{pendingCount}
                    </td>
                    <td>{manifest.expiresAt ? new Date(manifest.expiresAt).toLocaleDateString() : "No expiry"}</td>
                    <td>{manifest.sharingEnabled ? "On" : "Off"}</td>
                    <td>{pendingByDeck.get(filename) ?? 0}</td>
                    <td>
                      <Link href={`/admin/deck/${encodeURIComponent(filename)}`}>Manage</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className={styles.empty}>No decks found yet.</p>
        )}
      </section>

      <section className={styles.upload}>
        <h2>Upload New Deck</h2>
        <p>Place your HTML file in `public/decks/` and create a manifest from the API:</p>
        <pre>
          <code>
            {'curl -X PUT /api/decks/admin/decks -H "content-type: application/json" -d \'{"filename":"your-deck.html"}\''}
          </code>
        </pre>
      </section>
    </main>
  );
}
