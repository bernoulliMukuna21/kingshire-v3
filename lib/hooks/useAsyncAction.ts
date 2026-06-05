"use client";

import { useState, useCallback } from "react";

/**
 * Handles the repetitive loading/error state pattern for async button actions.
 * The `run` wrapper sets loading, clears error, awaits the callback, and
 * resets loading in a finally block — so components only need to supply
 * the core business logic.
 *
 * Components can still call `setError` directly for domain-specific messages
 * that come back from the API (e.g. `setError(data.error ?? "...")`).
 */
export function useAsyncAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, setError, run };
}
