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
    await page.goto("/organisation/setup");
    await expect(page).toHaveURL(/\/sign-up\?intent=organisation$/);
  });

  test("Organisation entry uses a clean, fixed-intent signup URL", async ({
    page,
  }) => {
    await page.goto("/organisation/start");
    await expect(page).toHaveURL(/\/sign-up\?intent=organisation$/);
    await expect(page).not.toHaveURL(/role=|next=/);
    await expect(page.getByText("0% complete")).toBeVisible();
  });

  test("Client and Kinglancer signup journeys expose the other choices", async ({
    page,
  }) => {
    await page.goto("/sign-up?role=client");
    await expect(
      page.getByRole("link", { name: "Become a Kinglancer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Set up an Organisation" }),
    ).toBeVisible();

    await page.goto("/sign-up?role=kinglancer");
    await expect(
      page.getByRole("link", { name: "Join as a Client" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Set up an Organisation" }),
    ).toBeVisible();
  });

  test("the Organisation discovery URL is singular and legacy links redirect", async ({
    page,
  }) => {
    await page.goto("/for-organisations");
    await expect(page).toHaveURL(/\/organisation$/);
    await expect(
      page.getByRole("heading", { name: /create opportunities as a team/i }),
    ).toBeVisible();
  });

  test("Get started presents Kinglancer before Client and Organisation", async ({
    page,
  }) => {
    await page.goto("/get-started");
    const journeyHeadings = await page.locator("h2").allTextContents();
    expect(journeyHeadings).toEqual([
      "I want to find work",
      "I need work done",
      "I represent an Organisation",
    ]);
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
