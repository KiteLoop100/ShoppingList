"use client";

/**
 * Catches errors that bubble to the root. In production this replaces the
 * entire UI so the user sees the error instead of "Internal Server Error".
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "600px" }}>
        <h1 style={{ color: "#c00" }}>Error</h1>
        <p>{error.message || "An unexpected error occurred."}</p>
        {process.env.NODE_ENV === "development" && error.stack && (
          <pre style={{ overflow: "auto", fontSize: "12px", background: "#f5f5f5", padding: "1rem" }}>
            {error.stack}
          </pre>
        )}
        <button
          type="button"
          onClick={() => reset()}
          style={{ marginTop: "1rem", padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
