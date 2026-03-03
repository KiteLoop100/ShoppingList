"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body className="bg-white text-aldi-text flex items-center justify-center min-h-screen p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Etwas ist schiefgelaufen</h1>
          <p className="text-gray-600">
            Der Fehler wurde automatisch gemeldet.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="bg-aldi-blue text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
