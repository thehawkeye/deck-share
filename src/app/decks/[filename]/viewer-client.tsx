"use client";

import { FormEvent, useEffect, useState } from "react";

import styles from "./page.module.css";

interface Props {
  filename: string;
  title: string;
  email: string;
  canShare: boolean;
  ownerAccess: boolean;
}

export function DeckViewerClient({ filename, title, email, canShare, ownerAccess }: Props) {
  const [open, setOpen] = useState(false);
  const [requestedEmail, setRequestedEmail] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const response = await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestedEmail }),
    });

    if (!response.ok) {
      setStatus("Unable to submit request.");
      return;
    }

    setStatus("Request submitted.");
    setRequestedEmail("");
  }

  const deckSrc = ownerAccess
    ? `/api/decks/${encodeURIComponent(filename)}?owner_access=true`
    : `/api/decks/${encodeURIComponent(filename)}`;

  return (
    <div className={styles.shell}>
      <iframe className={styles.frame} src={deckSrc} title={title} sandbox="allow-scripts allow-same-origin" />

      <aside className={styles.overlay}>
        <p className={styles.kicker}>Deck Share</p>
        <p className={styles.title}>{title}</p>
        <p className={styles.email}>{email}</p>
        {canShare ? (
          <button className={styles.shareButton} type="button" onClick={() => setOpen(true)}>
            Share
          </button>
        ) : null}
      </aside>

      {open ? (
        <div className={styles.modalBackdrop} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2>Request Access</h2>
            <p>Send an approval request for another recipient.</p>
            <form onSubmit={onSubmit}>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={requestedEmail}
                onChange={(event) => setRequestedEmail(event.target.value)}
              />
              <button type="submit">Submit Request</button>
            </form>
            {status ? <p className={styles.modalStatus}>{status}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
