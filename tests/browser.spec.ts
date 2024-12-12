import { test, expect, Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
});

test("User can register and login", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[name="username"]', "testuser");
    await page.fill('input[name="email"]', "testuser@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.fill('input[name="confirmPassword"]', "password123");
    await page.click('button[type="submit"]');
    expect(await page.url()).toBe("/");

    await page.goto("/login");
    await page.fill('input[name="email"]', "testuser@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    expect(await page.url()).toBe("/");
});
