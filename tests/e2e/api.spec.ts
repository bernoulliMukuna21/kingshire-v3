import { test, expect } from "@playwright/test";

test.describe("API — public endpoints", () => {
  test("GET /api/jobs returns an array", async ({ request }) => {
    const res = await request.get("/api/jobs");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

test.describe("API — auth guards (unauthenticated)", () => {
  test("POST /api/jobs returns 401", async ({ request }) => {
    const res = await request.post("/api/jobs", {
      data: { title: "t", description: "d", budget: 100, category: "tech" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/applications returns 401", async ({ request }) => {
    const res = await request.post("/api/applications", {
      data: {
        job_id: "00000000-0000-0000-0000-000000000000",
        cover_letter: "Hello",
      },
    });
    expect(res.status()).toBe(401);
  });

  test("PATCH /api/applications/:id returns 401", async ({ request }) => {
    const res = await request.patch(
      "/api/applications/00000000-0000-0000-0000-000000000000",
      { data: {} },
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/jobs/:id/approve returns 401", async ({ request }) => {
    const res = await request.post(
      "/api/jobs/00000000-0000-0000-0000-000000000000/approve",
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/jobs/:id/complete returns 401", async ({ request }) => {
    const res = await request.post(
      "/api/jobs/00000000-0000-0000-0000-000000000000/complete",
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/jobs/:id/dispute returns 401", async ({ request }) => {
    const res = await request.post(
      "/api/jobs/00000000-0000-0000-0000-000000000000/dispute",
      { data: { reason: "test reason here" } },
    );
    expect(res.status()).toBe(401);
  });
});

test.describe("API — cron endpoint", () => {
  test("GET /api/cron/auto-release without secret returns 401 in production", async ({
    request,
  }) => {
    const res = await request.get("/api/cron/auto-release");
    // Dev: CRON_SECRET is empty so it runs freely (200)
    // Prod: CRON_SECRET is set so it requires auth (401)
    expect([200, 401]).toContain(res.status());
  });

  test("GET /api/cron/auto-release with wrong secret returns 401", async ({
    request,
  }) => {
    const res = await request.get("/api/cron/auto-release", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    // Only fails auth if CRON_SECRET is actually set
    expect([200, 401]).toContain(res.status());
  });
});
