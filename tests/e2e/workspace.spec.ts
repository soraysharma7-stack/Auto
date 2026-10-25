import { expect, test } from "@playwright/test";

const routes = [
  { path: "/dashboard", feature: "your Auto workspace" },
  { path: "/chat", feature: "AI Chat" },
  { path: "/agents", feature: "AI Team" },
  { path: "/tasks", feature: "Task Manager" },
  { path: "/connections", feature: "Connections" },
  { path: "/agent-pc", feature: "Agent PC" },
  { path: "/usage", feature: "Usage" },
  { path: "/activity", feature: "Activity" },
  { path: "/settings", feature: "Settings" },
];

test("the root route opens the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Connect Supabase to use your Auto workspace" })).toBeVisible();
});

for (const route of routes) {
  test(`${route.path} is honest when services are not configured`, async ({ page }) => {
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: `Connect Supabase to use ${route.feature}`, exact: true })).toBeVisible();
    await expect(page.getByText("No credentials have been requested or stored.")).toBeVisible();
  });
}

test("unconfigured chat has no composer or simulated conversation", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByText("Connect Supabase to use AI Chat", { exact: true })).toBeVisible();
});

test("the mobile drawer navigates and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Agent PC", exact: true }).click();
  await expect(page).toHaveURL(/\/agent-pc$/);
  await expect(page.getByRole("heading", { name: "Connect Supabase to use Agent PC", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
});

test("login does not collect credentials before authentication is configured", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Connect Supabase first" })).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View setup instructions" })).toBeVisible();
});

test("data APIs report setup requirements instead of a generic crash", async ({ request }) => {
  const response = await request.get("/api/agents");
  expect(response.status()).toBe(503);
  expect(await response.json()).toMatchObject({ code: "SETUP_REQUIRED" });
});
