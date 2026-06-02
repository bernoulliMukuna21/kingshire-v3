import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    // Navbar is present
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("hero section renders a primary CTA", async ({ page }) => {
    await page.goto("/");
    // "Post a Job" link exists somewhere on the page
    await expect(
      page.getByRole("link", { name: /post a job/i }).first(),
    ).toBeVisible();
  });

  test("navigating to /jobs from nav works", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /browse jobs|jobs/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/jobs/);
  });
});
