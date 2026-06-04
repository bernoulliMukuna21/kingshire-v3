import { test, expect } from "@playwright/test";

test.describe("Sign In page", () => {
  test("renders form correctly", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", {
        name: /sign in to kingshire|sign in to kingshare|sign in/i,
      }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("jane@example.com")).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByPlaceholder("jane@example.com").fill("nobody@example.com");
    await page.getByPlaceholder(/password/i).fill("wrongpassword123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({
      timeout: 8000,
    });
  });

  test("link to sign-up page works", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: /create one free/i }).click();
    await expect(page).toHaveURL(/sign-up/);
  });
});

test.describe("Sign Up page", () => {
  test("renders account creation form", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(
      page.getByRole("heading", { name: /create your account/i }),
    ).toBeVisible();
    await expect(page.getByText(/choose client or kinglancer/i)).toBeVisible();
    await expect(page.getByPlaceholder("Jane", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("jane@example.com")).toBeVisible();
  });

  test("rejects incomplete email domains", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByPlaceholder("Jane", { exact: true }).fill("Paul");
    await page.getByPlaceholder("Doe").fill("Tester");
    await page.getByPlaceholder("jane@example.com").fill("paulin@fjkse");
    await page.getByPlaceholder("Min. 8 characters").fill("password123");
    await page.getByPlaceholder("Repeat your password").fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/valid email address/i)).toBeVisible();
  });

  test("link to sign-in page works", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByRole("link", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe("Forgot password page", () => {
  test("renders email input", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByPlaceholder("jane@example.com")).toBeVisible();
  });
});
