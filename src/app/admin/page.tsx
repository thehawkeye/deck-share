import { readdir } from "node:fs/promises";
import path from "node:path";

import Link from "next/link";
import { redirect } from "next/navigation";

import { hasValidAdminSession } from "@/lib/auth";
import { listDecks, listRequests } from "@/lib/manifests";

import { LogoutButton } from "./logout-button";
import styles from "./page.module.css";
import { RegisterDeckButton } from "./register-deck-button";

async function discoverStaticDecks(): Promise<string[]> {
  try {
    const staticDir = path.join(process.cwd(), "public", "static");
    const files = await readdir(staticDir, { withFileTypes: true });
    return files
      .filter((entry) => entry.isFile() && /\.html?$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "No expiry";

  const time = new Date(expiresAt).getTime();
  if (Number.isNaN(time)) return "Invalid";
  if (time < Date.now()) return "Expired";

  return new Date(expiresAt).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  let decks: Awaited<ReturnType<typeof listDecks>> = [];
  try {
    decks = await listDecks();
  } catch {
    decks = [];
  }

  const requestCounts = await Promise.allSettled(
    decks.map(async (deck) => ({
      filename: deck.filename,
      count: (await listRequests(deck.filename)).filter((entry) => entry.status === "pending").length,
    })),
  ).then((results) =>
    results
      .filter((r): r is PromiseFulfilledResult<{ filename: string; count: number }> => r.status === "fulfilled")
      .map((r) => r.value),
  );

  const pendingByDeck = new Map(requestCounts.map((item) => [item.filename, item.count]));
  const totalUsers = decks.reduce(
    (sum, deck) => sum + deck.manifest.emails.filter((entry) => entry.status !== "revoked").length,
    0,
  );
  const totalPending = requestCounts.reduce((sum, item) => sum + item.count, 0);

  const staticFiles = await discoverStaticDecks();
  const knownFiles = new Set(decks.map((deck) => deck.filename));
  const unregisteredFiles = staticFiles.filter((file) => !knownFiles.has(file));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Hawkeye Access Control</p>
          <h1>Deck Share Control Room</h1>
          <p className={styles.subhead}>Manage access, sharing requests, expiry windows, and deck manifests.</p>
        </div>
        <LogoutButton />
      </header>

      <section className={styles.stats}>
        <article>
          <p>Deck Manifests</p>
          <strong>{decks.length}</strong>
        </article>
        <article>
          <p>Authorized Recipients</p>
          <strong>{totalUsers}</strong>
        </article>
        <article>
          <p>Pending Requests</p>
          <strong>{totalPending}</strong>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Active Decks</h2>
          <p>Owner preview links open with owner bypass enabled.</p>
        </div>

        {decks.length ? (
          <div className={styles.deckGrid}>
            {decks.map(({ filename, manifest }) => {
              const activeCount = manifest.emails.filter((entry) => entry.status === "active").length;
              const pendingCount = manifest.emails.filter((entry) => entry.status === "pending").length;
              const requestCount = pendingByDeck.get(filename) ?? 0;

              return (
                <article className={styles.deckCard} key={filename}>
                  <div className={styles.deckTop}>
                    <h3>{manifest.title}</h3>
                    <span className={styles.modeBadge}>{manifest.mode}</span>
                  </div>

                  <p className={styles.filename}>{filename}</p>

                  <div className={styles.metaGrid}>
                    <p>
                      <span>Users</span>
                      <strong>{activeCount + pendingCount}</strong>
                    </p>
                    <p>
                      <span>Pending</span>
                      <strong>{requestCount}</strong>
                    </p>
                    <p>
                      <span>Sharing</span>
                      <strong>{manifest.sharingEnabled ? "On" : "Off"}</strong>
                    </p>
                    <p>
                      <span>Expiry</span>
                      <strong>{formatExpiry(manifest.expiresAt)}</strong>
                    </p>
                  </div>

                  <div className={styles.actions}>
                    <Link href={`/decks/${encodeURIComponent(filename)}?owner_access=true`} target="_blank" rel="noopener noreferrer">
                      View
                    </Link>
                    <Link href={`/admin/deck/${encodeURIComponent(filename)}`}>Manage</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>No deck manifests found yet.</p>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Discovered HTML Files</h2>
          <p>Files in <code>public/static</code> without a manifest.</p>
        </div>

        {unregisteredFiles.length ? (
          <ul className={styles.discoveryList}>
            {unregisteredFiles.map((filename) => (
              <li key={filename}>
                <div>
                  <p>{filename}</p>
                  <span>Not registered</span>
                </div>
                <RegisterDeckButton filename={filename} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>No unregistered HTML files found.</p>
        )}
      </section>
    </main>
  );
}
