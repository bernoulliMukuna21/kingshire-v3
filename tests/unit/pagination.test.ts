import { expect, it, vi } from "vitest";
import { collectPages } from "@/lib/db/pagination";
it("keeps records beyond the first page", async () => {
  const source = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const fetch = vi.fn(async (from: number, to: number) => ({
    data: source.slice(from, to + 1),
    error: null,
  }));
  expect(await collectPages(fetch)).toEqual(source);
  expect(fetch).toHaveBeenCalledTimes(7);
});
it("does not report partial results as complete on query failure", async () => {
  await expect(
    collectPages(async () => ({ data: null, error: { message: "offline" } })),
  ).rejects.toThrow("offline");
});
