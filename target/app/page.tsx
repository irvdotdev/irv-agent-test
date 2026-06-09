// Landing page — a single CTA. Realistic enough to instrument,
// minimal enough to keep the agent's instrumentation surface obvious.

import Link from "next/link";

export default function HomePage() {
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
      <h1 style={{ fontSize: "2.5rem", margin: 0, letterSpacing: "-0.02em" }}>
        Irv Demo App
      </h1>
      <p style={{ fontSize: "1rem", color: "#525252", margin: 0, maxWidth: 480, textAlign: "center" }}>
        A tiny Next.js app the agent will instrument with Irv analytics.
      </p>
      <Link
        href="/signup"
        style={{
          padding: "0.75rem 1.5rem",
          background: "#0a0a0a",
          color: "#fafafa",
          borderRadius: 6,
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Sign up →
      </Link>
    </main>
  );
}
