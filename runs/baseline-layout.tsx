// Root layout. INTENTIONALLY contains no analytics — the agent's job
// is to add the Irv tracking snippet to <head>. Keep the structure
// simple so there's exactly one place where the snippet belongs.

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Irv Demo App",
  description: "A tiny Next.js target used to test agent-driven Irv onboarding.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
          The agent should insert the Irv tracking snippet here as a
          <script async src="https://irv.dev/i.js?p={project_key}" />
          tag. Don't add it manually — that's what we're testing.
        */}
      </head>
      <body
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          padding: 0,
          background: "#fafafa",
          color: "#0a0a0a",
        }}
      >
        {children}
      </body>
    </html>
  );
}
