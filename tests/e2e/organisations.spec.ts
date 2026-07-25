import { expect, test } from "@playwright/test";

test.describe("Organisations — access guards", () => {
  test("unauthenticated users cannot open the organisation workspace", async ({
    page,
  }) => {
    await page.goto("/dashboard/organisations");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("unauthenticated users cannot create an organisation", async ({
    page,
  }) => {
    await page.goto("/dashboard/organisations/new");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("an unknown invitation token is rejected safely", async ({ page }) => {
    await page.goto(
      "/organisation-invitations/00000000-0000-0000-0000-000000000000",
    );
    await expect(
      page.getByText(/invitation.*invalid|invitation.*expired/i),
    ).toBeVisible();
  });
});
