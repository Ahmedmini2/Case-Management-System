import { expect, test } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /login/i })).toBeVisible();
});

test("portal page renders", async ({ page }) => {
  await page.goto("/portal");
  await expect(page.getByRole("heading", { name: /submit a request/i })).toBeVisible();
});
