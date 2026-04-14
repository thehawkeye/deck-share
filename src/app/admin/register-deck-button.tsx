"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import styles from "./page.module.css";

export function RegisterDeckButton({ filename }: { filename: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function onRegister() {
    setError("");

    const title = filename
      .replace(/\.html?$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const response = await fetch(`/api/decks/admin/decks/${encodeURIComponent(filename)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      setError("Failed");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className={styles.registerWrap}>
      <button type="button" onClick={onRegister} disabled={isPending}>
        {isPending ? "Registering..." : "Create Manifest"}
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
