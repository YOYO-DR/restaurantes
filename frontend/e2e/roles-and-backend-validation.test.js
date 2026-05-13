import { expect, test } from "@playwright/test"

const USERS = {
  cliente: {
    email: "cliente.e2e@foodhub.local",
    password: "E2EPass123!",
    dashboard: "/dashboard/cliente",
  },
  dueno: {
    email: "dueno.e2e@foodhub.local",
    password: "E2EPass123!",
    dashboard: "/dashboard/restaurante",
  },
  admin: {
    email: "admin.e2e@foodhub.local",
    password: "E2EPass123!",
    dashboard: "/dashboard/admin",
  },
}

async function login(page, user) {
  await page.goto("/login")
  await page.getByLabel(/correo electronico/i).fill(user.email)
  await page.getByLabel(/contrasena/i).fill(user.password)
  await page.getByRole("button", { name: /iniciar sesion/i }).click()
  await expect(page).toHaveURL(new RegExp(user.dashboard.replaceAll("/", "\\/")))
}

test.describe("Permisos entre roles", () => {
  test("usuario no autenticado va a login", async ({ page }) => {
    await page.goto("/dashboard/admin")
    await expect(page).toHaveURL(/\/login/)
  })

  test("cliente no entra a admin ni dueno", async ({ page }) => {
    await login(page, USERS.cliente)

    await page.goto("/dashboard/admin")
    await expect(page).toHaveURL(/\/dashboard\/cliente/)

    await page.goto("/dashboard/restaurante")
    await expect(page).toHaveURL(/\/dashboard\/cliente/)
  })

  test("dueno no entra a admin", async ({ page }) => {
    await login(page, USERS.dueno)
    await page.goto("/dashboard/admin")
    await expect(page).toHaveURL(/\/dashboard\/restaurante/)
  })

  test("admin no entra a dashboard de dueno", async ({ page }) => {
    await login(page, USERS.admin)
    await page.goto("/dashboard/restaurante")
    await expect(page).toHaveURL(/\/dashboard\/admin/)
  })
})

test.describe("Validacion cliente", () => {
  test("dashboard y vistas cliente consumen backend", async ({ page }) => {
    await login(page, USERS.cliente)

    const dashboardResponse = page.waitForResponse((response) =>
      response.url().includes("/api/customer/dashboard/") && response.status() === 200,
    )
    await page.goto("/dashboard/cliente")
    const dashboardApi = await dashboardResponse
    const dashboardPayload = await dashboardApi.json()

    await expect(page.getByRole("heading", { name: /hola, cliente e2e/i })).toBeVisible()
    expect(dashboardPayload.user_name).toContain("Cliente E2E")
    expect(
      dashboardPayload.favorite_restaurants.some((restaurant) =>
        /restaurante e2e/i.test(restaurant.name),
      ),
    ).toBeTruthy()

    const ordersResponse = page.waitForResponse((response) =>
      response.url().includes("/api/customer/orders/") && response.status() === 200,
    )
    await page.goto("/dashboard/cliente/pedidos")
    await ordersResponse
    await expect(page.getByText(/ord-e2e-new/i)).toBeVisible()

    const favoritesResponse = page.waitForResponse((response) =>
      response.url().includes("/api/customer/favorites/") && response.status() === 200,
    )
    await page.goto("/dashboard/cliente/favoritos")
    const favoritesApi = await favoritesResponse
    const favoritesPayload = await favoritesApi.json()
    expect(favoritesPayload.length).toBeGreaterThan(0)
    await expect(page.getByRole("link", { name: /ver menu/i }).first()).toBeVisible()

    await page.goto("/dashboard/cliente/puntos")
    await expect(page.getByText(/780/).first()).toBeVisible()
  })

  test("configuracion cliente persiste preferencias y metodos de pago", async ({ page }) => {
    await login(page, USERS.cliente)

    const settingsResponse = page.waitForResponse((response) =>
      response.url().includes("/api/customer/notification-preferences/") && response.status() === 200,
    )
    await page.goto("/dashboard/cliente/configuracion")
    await settingsResponse

    const smsRow = page.locator("div.flex.items-center.justify-between.gap-4.rounded-lg.border.border-border.p-4", {
      has: page.locator("p", { hasText: /^SMS$/ }),
    })
    const smsToggle = smsRow.getByRole("switch")
    const beforeState = await smsToggle.getAttribute("data-state")
    const updatePreferenceResponse = page.waitForResponse((response) =>
      response.url().includes("/api/customer/notification-preferences/")
      && response.request().method() === "PATCH"
      && response.status() === 200,
    )
    await smsToggle.click()
    const updatedPreference = await (await updatePreferenceResponse).json()
    await expect(page.getByText(/preferencia actualizada/i)).toBeVisible()

    const refreshedSettingsResponse = page.waitForResponse((response) =>
      response.url().includes("/api/customer/notification-preferences/")
      && response.request().method() === "GET"
      && response.status() === 200,
    )
    await page.reload()
    const refreshedPreferences = await (await refreshedSettingsResponse).json()
    const persistedPreference = refreshedPreferences.find(
      (preference) => preference.id === updatedPreference.id,
    )
    expect(persistedPreference?.is_enabled).toBe(updatedPreference.is_enabled)

    const afterState = await smsRow.getByRole("switch").getAttribute("data-state")
    const expectedState = updatedPreference.is_enabled ? "checked" : "unchecked"
    expect(afterState).toBe(expectedState)
    expect(afterState).not.toBe(beforeState)

    await page.getByPlaceholder("**** **** **** 4242").fill("**** **** **** 9988")
    await page.getByPlaceholder("MM").fill("12")
    await page.getByPlaceholder("YY").fill("30")
    await page.getByRole("button", { name: /agregar metodo de pago/i }).click()
    await expect(page.getByText(/metodo agregado/i)).toBeVisible()
    await expect(page.getByText(/\*\*\*\* \*\*\*\* \*\*\*\* 9988/i).first()).toBeVisible()
  })
})

test.describe("Validacion dueno", () => {
  test("dashboard dueno consume backend y configuracion aplica", async ({ page }, testInfo) => {
    await login(page, USERS.dueno)

    const dashboardResponse = page.waitForResponse((response) =>
      response.url().includes("/api/owner/restaurants/") && response.url().includes("/dashboard/") && response.status() === 200,
    )
    await page.goto("/dashboard/restaurante")
    const ownerDashboardApi = await dashboardResponse
    const ownerDashboardPayload = await ownerDashboardApi.json()
    expect(ownerDashboardPayload.restaurant.name).toContain("Restaurante E2E")

    const suffix = `${testInfo.project.name}-${Date.now()}`
    const newName = `Restaurante E2E ${suffix}`

    const settingsResponse = page.waitForResponse((response) =>
      response.url().includes("/api/owner/restaurants/") && response.url().includes("/settings/") && response.status() === 200,
    )
    await page.goto("/dashboard/restaurante/configuracion")
    await settingsResponse
    await page.locator("div:has(> label:text-is('Nombre del negocio')) input").fill(newName)
    await page.getByRole("button", { name: /guardar configuracion/i }).click()
    await expect(page.getByText(/configuracion actualizada/i)).toBeVisible()

    const reloadedDashboardResponse = page.waitForResponse((response) =>
      response.url().includes("/api/owner/restaurants/") && response.url().includes("/dashboard/") && response.status() === 200,
    )
    await page.goto("/dashboard/restaurante")
    const reloadedDashboardApi = await reloadedDashboardResponse
    const reloadedDashboardPayload = await reloadedDashboardApi.json()
    expect(reloadedDashboardPayload.restaurant.name).toBe(newName)
  })

  test("perfil de dueno muestra estado verificado segun backend", async ({ page }) => {
    await login(page, USERS.dueno)
    await page.goto("/dashboard/restaurante/perfil")
    await expect(page.getByText(/cuenta pendiente de verificacion|cuenta verificada/i)).toBeVisible()
  })
})

test.describe("Validacion admin", () => {
  test("dashboard admin consume backend y configuracion persiste", async ({ page }, testInfo) => {
    await login(page, USERS.admin)

    const dashboardResponse = page.waitForResponse((response) =>
      response.url().includes("/api/admin/dashboard/") && response.status() === 200,
    )
    await page.goto("/dashboard/admin")
    await dashboardResponse
    await expect(page.getByRole("heading", { name: /panel de administracion/i })).toBeVisible()

    const newPlatformName = `FoodHub E2E ${testInfo.project.name}-${Date.now()}`

    const settingsResponse = page.waitForResponse((response) =>
      response.url().includes("/api/admin/settings/") && response.status() === 200,
    )
    await page.goto("/dashboard/admin/configuracion")
    await settingsResponse

    const platformNameInput = page.locator("div:has(> label:text-is('Nombre de la plataforma')) input")
    await platformNameInput.fill(newPlatformName)
    await page.getByRole("button", { name: /guardar cambios/i }).click()
    await expect(page.getByText(/configuracion administrativa actualizada/i)).toBeVisible()

    await page.reload()
    await page.getByRole("button", { name: /general/i }).click()
    await expect(platformNameInput).toHaveValue(newPlatformName)
  })

  test("contador de notificaciones en header usa backend", async ({ page }) => {
    await login(page, USERS.admin)

    const bellBadge = page.locator("header button:has(svg.lucide-bell) span")
    const unreadBefore = (await bellBadge.count()) > 0
      ? Number((await bellBadge.first().innerText()).trim()) || 0
      : 0

    const authResponse = await page.request.post("http://localhost:8000/api/auth/login/", {
      data: {
        email: USERS.admin.email,
        password: USERS.admin.password,
      },
    })
    expect(authResponse.ok()).toBeTruthy()
    const authPayload = await authResponse.json()

    const createNotificationResponse = await page.request.post("http://localhost:8000/api/notifications/center/", {
      headers: {
        Authorization: `Bearer ${authPayload.access}`,
      },
      data: {
        type_code: "admin_alert",
        payload_json: { title: "Alerta E2E" },
      },
    })
    expect(createNotificationResponse.ok()).toBeTruthy()

    const notificationCenterResponse = page.waitForResponse((response) =>
      response.url().includes("/api/notifications/center/")
      && response.request().method() === "GET"
      && response.status() === 200,
    )
    await page.reload()
    await notificationCenterResponse

    await expect.poll(async () => {
      const count = await bellBadge.count()
      if (count === 0) {
        return 0
      }
      return Number((await bellBadge.first().innerText()).trim()) || 0
    }).toBeGreaterThan(unreadBefore)
  })
})
