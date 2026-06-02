import { test, expect } from "@playwright/test";

test.describe("Jobs listing", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/jobs");
    await expect(
      page.getByRole("heading", { name: /browse jobs/i }),
    ).toBeVisible();
  });

  test("shows jobs or an empty state — never errors", async ({ page }) => {
    await page.goto("/jobs");
    // The page must not show an unhandled error
    await expect(
      page.getByText(/application error|unhandled/i),
    ).not.toBeVisible();
  });
});

test.describe("Post a job — auth guard", () => {
  test("redirects unauthenticated user to sign-in", async ({ page }) => {
    await page.goto("/jobs/post");
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe("Job detail page", () => {
  test("non-existent job shows 404 page", async ({ page }) => {
    // A UUID that won't exist in the DB
    await page.goto("/jobs/00000000-0000-0000-0000-000000000000");
    // Server calls notFound() — Next.js renders a 404 page at the same URL
    await expect(
      page.getByRole("heading", { name: /404|not found/i }),
    ).toBeVisible();
  });
});
