import { expect, it } from "vitest";
import {
  createKingsChatState,
  verifyKingsChatState,
} from "@/lib/kingschat-state";
it("binds the callback to the browser that initiated login", () => {
  const state = createKingsChatState("/dashboard/client", 1000);
  expect(verifyKingsChatState(state, state, 1100)).toBe("/dashboard/client");
  expect(verifyKingsChatState(state, undefined, 1100)).toBeNull();
  expect(
    verifyKingsChatState(
      state,
      createKingsChatState("/dashboard/client", 1000),
      1100,
    ),
  ).toBeNull();
  expect(verifyKingsChatState(state, state, 601001)).toBeNull();
});
it("rejects destination tampering and external redirects", () => {
  const state = createKingsChatState("/\\evil.example", 1000);
  expect(verifyKingsChatState(state, state, 1100)).toBe("/");
  const valid = createKingsChatState("/jobs", 1000);
  expect(verifyKingsChatState(valid + "x", valid, 1100)).toBeNull();
});

import { handleKingsChatCallback } from "@/lib/kingschat-auth";
it("rejects a cross-site callback without browser state before contacting the provider", async () => {
  const state = createKingsChatState("/jobs");
  const request = new Request("https://example.test/auth/callback", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: "unused", origin: state }),
  });
  const response = await handleKingsChatCallback(request);
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toContain("error=auth_failed");
});
