import { redirect } from "next/navigation";

import { hasValidAdminSession } from "@/lib/auth";

import { LoginForm } from "./login-form";
import styles from "./page.module.css";

export default async function AdminLoginPage() {
  if (await hasValidAdminSession()) {
    redirect("/admin");
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Deck Share</p>
        <h1>Admin Login</h1>
        <LoginForm />
      </section>
    </main>
  );
}
