"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./page.module.css";

export function LoginForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/decks/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Invalid token");
      return;
    }

    router.replace("/admin");
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label htmlFor="admin-token">Admin Token</label>
      <input
        id="admin-token"
        type="password"
        required
        value={token}
        onChange={(event) => setToken(event.target.value)}
      />
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="submit" disabled={loading}>
        {loading ? "Checking..." : "Login"}
      </button>
    </form>
  );
}
