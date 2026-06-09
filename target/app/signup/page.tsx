// Sign-up page — a simple form. The agent will instrument the form
// submit (via the Irv autocapture snippet, or via explicit irv.track
// calls in the onSubmit handler). Either path is fine.

"use client";

import { useState } from "react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Stays purely local — no backend. The autocapture snippet sees
    // the form submission and records it regardless.
    setDone(true);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "2rem",
      }}
    >
      {done ? (
        <>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Thanks.</h1>
          <p style={{ color: "#525252", margin: 0 }}>That submission should have hit Irv.</p>
        </>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", width: 320 }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Sign up</h1>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "0.625rem 0.875rem",
              border: "1px solid #d4d4d4",
              borderRadius: 6,
              fontSize: "0.95rem",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "0.625rem 1rem",
              background: "#0a0a0a",
              color: "#fafafa",
              border: "none",
              borderRadius: 6,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Create account
          </button>
        </form>
      )}
    </main>
  );
}
