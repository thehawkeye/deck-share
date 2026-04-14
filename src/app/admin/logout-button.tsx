"use client";

import { useRouter } from "next/navigation";

import styles from "./page.module.css";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/decks/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <button type="button" className={styles.logout} onClick={onLogout}>
      Logout
    </button>
  );
}
