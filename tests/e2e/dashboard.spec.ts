import { test, expect } from "@playwright/test";

test.describe("Dashboard — auth redirects", () => {
  test("unauthenticated /dashboard/client redirects to sign-in", async ({
    page,
  }) => {
    await page.goto("/dashboard/client");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("unauthenticated /dashboard/kinglancer redirects to sign-in", async ({
    page,
  }) => {
    await page.goto("/dashboard/kinglancer");
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe("Admin — access control", () => {
  test("unauthenticated /admin redirects away", async ({ page }) => {
    await page.goto("/admin");
    // Redirects to sign-in or home depending on auth state
    await expect(page).not.toHaveURL("/admin");
  });
});

test.describe("Payment pages — auth guards", () => {
  test("unauthenticated /jobs/:id/pay redirects away", async ({ page }) => {
    await page.goto(
      "/jobs/00000000-0000-0000-0000-000000000000/pay?cs=pi_test_123",
    );
    await expect(page).toHaveURL(/sign-in/);
  });
});
