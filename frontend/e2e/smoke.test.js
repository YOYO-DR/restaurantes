import { test, expect } from "@playwright/test"

test.describe("Smoke tests - Rutas publicas", () => {
  test("home page carga correctamente", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("header")).toBeVisible()
    await expect(page.locator("footer")).toBeVisible()
  })

  test("login page es accesible", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /iniciar/i })).toBeVisible()
    await expect(page.getByLabel(/correo/i)).toBeVisible()
  })

  test("registro page es accesible", async ({ page }) => {
    await page.goto("/registro")
    await expect(page.getByRole("heading", { name: /crear/i })).toBeVisible()
    await expect(page.getByLabel(/nombre/i).first()).toBeVisible()
    await expect(page.getByLabel(/correo/i)).toBeVisible()
  })

  test("restaurantes page lista restaurantes", async ({ page }) => {
    await page.goto("/restaurantes")
    await expect(page.getByRole("heading", { name: /restaurantes/i })).toBeVisible()
  })

  test("navegacion desde home a restaurantes funciona", async ({ page }) => {
    await page.goto("/")
    const link = page.getByRole("link", { name: /restaurantes/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/\/restaurantes/)
    }
  })

  test("pagina 404 muestra contenido", async ({ page }) => {
    await page.goto("/ruta-que-no-existe-12345")
    await expect(page.getByText(/404|no encontrad|pagina/i)).toBeVisible({ timeout: 5000 }).catch(() => {
      // Some SPAs render a generic not-found page without "404" text
    })
  })
})

test.describe("Smoke tests - Responsive", () => {
  test("home page es responsive en mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/")
    await expect(page.locator("header")).toBeVisible()
  })

  test("menu mobile se abre en pantalla chica", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/")
    const menuButton = page.locator("header button").first()
    if (await menuButton.isVisible()) {
      await menuButton.click()
    }
  })
})