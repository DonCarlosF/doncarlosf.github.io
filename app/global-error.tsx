"use client";

import { useEffect } from "react";

// Replaces the root layout when it fails, so it must render its own <html>/<body>
// and cannot rely on globals.css or the font variables.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong | Kingdom Builders Christian Fellowship</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#fbf6ee",
          color: "#211a14",
          fontFamily: "Georgia, serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#7a1e2b", fontWeight: 600 }}>
            Something went wrong
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.1, margin: "8px 0 12px" }}>This page hit a snag.</h1>
          <p style={{ color: "#6f6256", margin: "0 0 20px" }}>Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#7a1e2b",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
