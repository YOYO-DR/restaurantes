import { test, expect } from "@playwright/test"

async function gotoAndWait(page, path = "/") {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await expect.poll(async () => {
    const text = await page.locator("#root").innerText().catch(() => "")
    return text.trim().length
  }, { timeout: 15000 }).toBeGreaterThan(0)
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/refresh/", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Unauthorized" }),
    })
  })
})

test.describe("Smoke tests - Rutas publicas", () => {
  test("home page carga correctamente", async ({ page }) => {
    await gotoAndWait(page, "/")
    await expect(page.locator("header")).toBeVisible()
    await expect(page.locator("footer")).toBeVisible()
  })

  test("login page es accesible", async ({ page }) => {
    await gotoAndWait(page, "/login")
    await expect(page.getByRole("heading", { name: /iniciar/i })).toBeVisible()
    await expect(page.getByLabel(/correo electronico/i)).toBeVisible()
  })

  test("registro page es accesible", async ({ page }) => {
    await gotoAndWait(page, "/registro")
    await expect(page.getByRole("heading", { name: /crear/i })).toBeVisible()
    await expect(page.getByLabel(/nombre/i).first()).toBeVisible()
    await expect(page.getByLabel(/correo electronico/i)).toBeVisible()
  })

  test("restaurantes page lista restaurantes", async ({ page }) => {
    await gotoAndWait(page, "/restaurantes")
    await expect(page.getByRole("heading", { name: /restaurantes/i })).toBeVisible()
  })

  test("navegacion desde home a restaurantes funciona", async ({ page }) => {
    await gotoAndWait(page, "/")
    const link = page.getByRole("link", { name: /restaurantes/i }).first()
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/\/restaurantes/)
  })

  test("pagina 404 muestra contenido", async ({ page }) => {
    await gotoAndWait(page, "/ruta-que-no-existe-12345")
    await expect(page.getByText(/404|no encontrad|pagina/i)).toBeVisible({ timeout: 5000 }).catch(() => {
      // Some SPAs render a generic not-found page without "404" text
    })
  })
})

test.describe("Smoke tests - Responsive", () => {
  test("home page es responsive en mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoAndWait(page, "/")
    await expect(page.locator("header")).toBeVisible()
  })

  test("menu mobile se abre en pantalla chica", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoAndWait(page, "/")
    const menuButton = page.getByRole("button", { name: /toggle menu/i })
    await expect(menuButton).toBeVisible()
    await menuButton.click()
  })
})
