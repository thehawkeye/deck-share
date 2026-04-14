"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { DeckManifest, DeckShareRequest } from "@/lib/manifests";

import styles from "./page.module.css";

type Tab = "users" | "requests" | "settings";

export function DeckEditorClient({
  filename,
  initialManifest,
  initialRequests,
}: {
  filename: string;
  initialManifest: DeckManifest;
  initialRequests: DeckShareRequest[];
}) {
  const router = useRouter();
  const [manifest, setManifest] = useState(initialManifest);
  const [requests, setRequests] = useState(initialRequests);
  const [tab, setTab] = useState<Tab>("users");
  const [titleDraft, setTitleDraft] = useState(initialManifest.title);
  const [singleEmail, setSingleEmail] = useState("");
  const [csvBulk, setCsvBulk] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  const requestTabEnabled = manifest.sharingEnabled;
  const activeUsers = useMemo(
    () => manifest.emails.filter((entry) => entry.status !== "revoked"),
    [manifest.emails],
  );

  async function refreshManifest() {
    const response = await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}`);
    if (!response.ok) return;
    const data = (await response.json()) as { manifest: DeckManifest };
    setManifest(data.manifest);
    setTitleDraft(data.manifest.title);
  }

  async function saveTitle() {
    if (!titleDraft.trim() || titleDraft.trim() === manifest.title) {
      return;
    }
    setPending(true);
    const response = await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: titleDraft.trim() }),
    });
    setPending(false);
    if (!response.ok) return;
    const data = (await response.json()) as { manifest: DeckManifest };
    setManifest(data.manifest);
  }

  async function toggleSharing(next: boolean) {
    setManifest((current) => ({ ...current, sharingEnabled: next }));
    const response = await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}/sharing`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sharingEnabled: next }),
    });
    if (!response.ok) {
      await refreshManifest();
    }
  }

  async function onAddEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emails = singleEmail
      .split(/[\s,]+/)
      .map((email) => email.trim())
      .filter(Boolean);
    if (!emails.length) return;

    setPending(true);
    setNotice("");
    const response = await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}/emails`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emails }),
    });
    setPending(false);
    if (!response.ok) {
      setNotice("Failed to add users.");
      return;
    }

    setSingleEmail("");
    setNotice("Magic links sent.");
    await refreshManifest();
  }

  async function onBulkImport() {
    const emails = csvBulk
      .split(/[\n,;]+/)
      .map((email) => email.trim())
      .filter(Boolean);
    if (!emails.length) return;

    setPending(true);
    setNotice("");
    const response = await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}/emails`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emails }),
    });
    setPending(false);
    if (!response.ok) {
      setNotice("Bulk import failed.");
      return;
    }

    setCsvBulk("");
    setNotice("Bulk invite sent.");
    await refreshManifest();
  }

  async function resend(email: string) {
    await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}/resend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setNotice(`Magic link resent to ${email}`);
  }

  async function revoke(email: string) {
    await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}/emails`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, status: "revoked" }),
    });
    await refreshManifest();
  }

  async function remove(email: string) {
    await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}/emails`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emails: [email] }),
    });
    await refreshManifest();
  }

  async function approve(requestId: string) {
    await fetch(
      `/api/decks/admin/decks/${encodeURIComponent(filename)}/requests/${encodeURIComponent(requestId)}/approve`,
      { method: "POST" },
    );
    setRequests((current) => current.filter((entry) => entry.id !== requestId));
    await refreshManifest();
  }

  async function reject(requestId: string) {
    await fetch(
      `/api/decks/admin/decks/${encodeURIComponent(filename)}/requests/${encodeURIComponent(requestId)}/reject`,
      { method: "POST" },
    );
    setRequests((current) => current.filter((entry) => entry.id !== requestId));
  }

  async function onModeChange(mode: DeckManifest["mode"]) {
    setManifest((current) => ({ ...current, mode }));
    const response = await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}/mode`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!response.ok) {
      await refreshManifest();
    }
  }

  async function onExpiryChange(value: string | null) {
    setManifest((current) => ({ ...current, expiresAt: value }));
    const response = await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}/expiresAt`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expiresAt: value }),
    });
    if (!response.ok) {
      await refreshManifest();
    }
  }

  async function deleteManifest() {
    const confirmed = window.confirm("Delete this manifest? The deck file will remain on disk.");
    if (!confirmed) return;

    await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}`, { method: "DELETE" });
    router.push("/admin");
  }

  return (
    <section className={styles.editor}>
      <header className={styles.top}>
        <div className={styles.titleGroup}>
          <input
            className={styles.titleInput}
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={saveTitle}
          />
          <span className={styles.modeBadge}>{manifest.mode}</span>
        </div>

        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={manifest.sharingEnabled}
            onChange={(event) => toggleSharing(event.target.checked)}
          />
          Sharing Enabled
        </label>
      </header>

      <nav className={styles.tabs}>
        <button type="button" onClick={() => setTab("users")} data-active={tab === "users"}>
          Users
        </button>
        {requestTabEnabled ? (
          <button type="button" onClick={() => setTab("requests")} data-active={tab === "requests"}>
            Requests ({requests.length})
          </button>
        ) : null}
        <button type="button" onClick={() => setTab("settings")} data-active={tab === "settings"}>
          Settings
        </button>
      </nav>

      {tab === "users" ? (
        <section className={styles.panel}>
          <div className={styles.formRow}>
            <form onSubmit={onAddEmail}>
              <input
                type="email"
                required
                placeholder="email@example.com"
                value={singleEmail}
                onChange={(event) => setSingleEmail(event.target.value)}
              />
              <button type="submit" disabled={pending}>
                Add & Send Magic Link
              </button>
            </form>
          </div>

          <div className={styles.bulkRow}>
            <textarea
              placeholder="Paste CSV or newline-separated emails"
              value={csvBulk}
              onChange={(event) => setCsvBulk(event.target.value)}
            />
            <button type="button" onClick={onBulkImport} disabled={pending}>
              CSV Bulk Import
            </button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Added By</th>
                <th>Added At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {manifest.emails.map((entry) => (
                <tr key={entry.email}>
                  <td>{entry.email}</td>
                  <td>
                    <span className={styles.status} data-status={entry.status}>
                      {entry.status}
                    </span>
                  </td>
                  <td>{entry.addedBy}</td>
                  <td>{new Date(entry.addedAt).toLocaleString()}</td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" onClick={() => resend(entry.email)}>
                        Resend
                      </button>
                      <button type="button" onClick={() => revoke(entry.email)}>
                        Revoke
                      </button>
                      <button type="button" onClick={() => remove(entry.email)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "requests" && requestTabEnabled ? (
        <section className={styles.panel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Requested By</th>
                <th>Requested Email</th>
                <th>Timestamp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.fromEmail}</td>
                  <td>{entry.requestedEmail}</td>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" onClick={() => approve(entry.id)}>
                        Approve
                      </button>
                      <button type="button" onClick={() => reject(entry.id)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "settings" ? (
        <section className={styles.panel}>
          <div className={styles.setting}>
            <label>Mode</label>
            <select value={manifest.mode} onChange={(event) => onModeChange(event.target.value as DeckManifest["mode"])}>
              <option value="locked">locked</option>
              <option value="request">request</option>
              <option value="open">open</option>
            </select>
          </div>

          <div className={styles.setting}>
            <label>Expiry</label>
            <div className={styles.expiryControls}>
              <input
                type="datetime-local"
                value={manifest.expiresAt ? toLocalDateTime(manifest.expiresAt) : ""}
                onChange={(event) => {
                  const value = event.target.value;
                  onExpiryChange(value ? new Date(value).toISOString() : null);
                }}
              />
              <button type="button" onClick={() => onExpiryChange(null)}>
                No expiry
              </button>
            </div>
          </div>

          <div className={styles.dangerZone}>
            <h3>Danger Zone</h3>
            <p>Delete the manifest only. The file in `public/decks/` remains untouched.</p>
            <button type="button" onClick={deleteManifest}>
              Delete Manifest
            </button>
          </div>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <p>{activeUsers.length} active/pending users</p>
        {notice ? <p>{notice}</p> : null}
      </footer>
    </section>
  );
}

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
