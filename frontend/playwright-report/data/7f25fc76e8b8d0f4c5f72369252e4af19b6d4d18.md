# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: roles-and-backend-validation.test.js >> Validacion admin >> contador de notificaciones en header usa backend
- Location: e2e/roles-and-backend-validation.test.js:215:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel(/correo electronico/i)

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test"
  2   | 
  3   | const USERS = {
  4   |   cliente: {
  5   |     email: "cliente.e2e@foodhub.local",
  6   |     password: "E2EPass123!",
  7   |     dashboard: "/dashboard/cliente",
  8   |   },
  9   |   dueno: {
  10  |     email: "dueno.e2e@foodhub.local",
  11  |     password: "E2EPass123!",
  12  |     dashboard: "/dashboard/restaurante",
  13  |   },
  14  |   admin: {
  15  |     email: "admin.e2e@foodhub.local",
  16  |     password: "E2EPass123!",
  17  |     dashboard: "/dashboard/admin",
  18  |   },
  19  | }
  20  | 
  21  | async function login(page, user) {
  22  |   await page.goto("/login")
> 23  |   await page.getByLabel(/correo electronico/i).fill(user.email)
      |                                                ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  24  |   await page.getByLabel(/contrasena/i).fill(user.password)
  25  |   await page.getByRole("button", { name: /iniciar sesion/i }).click()
  26  |   await expect(page).toHaveURL(new RegExp(user.dashboard.replaceAll("/", "\\/")))
  27  | }
  28  | 
  29  | test.describe("Permisos entre roles", () => {
  30  |   test("usuario no autenticado va a login", async ({ page }) => {
  31  |     await page.goto("/dashboard/admin")
  32  |     await expect(page).toHaveURL(/\/login/)
  33  |   })
  34  | 
  35  |   test("cliente no entra a admin ni dueno", async ({ page }) => {
  36  |     await login(page, USERS.cliente)
  37  | 
  38  |     await page.goto("/dashboard/admin")
  39  |     await expect(page).toHaveURL(/\/dashboard\/cliente/)
  40  | 
  41  |     await page.goto("/dashboard/restaurante")
  42  |     await expect(page).toHaveURL(/\/dashboard\/cliente/)
  43  |   })
  44  | 
  45  |   test("dueno no entra a admin", async ({ page }) => {
  46  |     await login(page, USERS.dueno)
  47  |     await page.goto("/dashboard/admin")
  48  |     await expect(page).toHaveURL(/\/dashboard\/restaurante/)
  49  |   })
  50  | 
  51  |   test("admin no entra a dashboard de dueno", async ({ page }) => {
  52  |     await login(page, USERS.admin)
  53  |     await page.goto("/dashboard/restaurante")
  54  |     await expect(page).toHaveURL(/\/dashboard\/admin/)
  55  |   })
  56  | })
  57  | 
  58  | test.describe("Validacion cliente", () => {
  59  |   test("dashboard y vistas cliente consumen backend", async ({ page }) => {
  60  |     await login(page, USERS.cliente)
  61  | 
  62  |     const dashboardResponse = page.waitForResponse((response) =>
  63  |       response.url().includes("/api/customer/dashboard/") && response.status() === 200,
  64  |     )
  65  |     await page.goto("/dashboard/cliente")
  66  |     const dashboardApi = await dashboardResponse
  67  |     const dashboardPayload = await dashboardApi.json()
  68  | 
  69  |     await expect(page.getByRole("heading", { name: /hola, cliente e2e/i })).toBeVisible()
  70  |     expect(dashboardPayload.user_name).toContain("Cliente E2E")
  71  |     expect(
  72  |       dashboardPayload.favorite_restaurants.some((restaurant) =>
  73  |         /restaurante e2e/i.test(restaurant.name),
  74  |       ),
  75  |     ).toBeTruthy()
  76  | 
  77  |     const ordersResponse = page.waitForResponse((response) =>
  78  |       response.url().includes("/api/customer/orders/") && response.status() === 200,
  79  |     )
  80  |     await page.goto("/dashboard/cliente/pedidos")
  81  |     await ordersResponse
  82  |     await expect(page.getByText(/ord-e2e-new/i)).toBeVisible()
  83  | 
  84  |     const favoritesResponse = page.waitForResponse((response) =>
  85  |       response.url().includes("/api/customer/favorites/") && response.status() === 200,
  86  |     )
  87  |     await page.goto("/dashboard/cliente/favoritos")
  88  |     const favoritesApi = await favoritesResponse
  89  |     const favoritesPayload = await favoritesApi.json()
  90  |     expect(favoritesPayload.length).toBeGreaterThan(0)
  91  |     await expect(page.getByRole("link", { name: /ver menu/i }).first()).toBeVisible()
  92  | 
  93  |     await page.goto("/dashboard/cliente/puntos")
  94  |     await expect(page.getByText(/780/).first()).toBeVisible()
  95  |   })
  96  | 
  97  |   test("configuracion cliente persiste preferencias y metodos de pago", async ({ page }) => {
  98  |     await login(page, USERS.cliente)
  99  | 
  100 |     const settingsResponse = page.waitForResponse((response) =>
  101 |       response.url().includes("/api/customer/notification-preferences/") && response.status() === 200,
  102 |     )
  103 |     await page.goto("/dashboard/cliente/configuracion")
  104 |     await settingsResponse
  105 | 
  106 |     const smsRow = page.locator("div.flex.items-center.justify-between.gap-4.rounded-lg.border.border-border.p-4", {
  107 |       has: page.locator("p", { hasText: /^SMS$/ }),
  108 |     })
  109 |     const smsToggle = smsRow.getByRole("switch")
  110 |     const beforeState = await smsToggle.getAttribute("data-state")
  111 |     const updatePreferenceResponse = page.waitForResponse((response) =>
  112 |       response.url().includes("/api/customer/notification-preferences/")
  113 |       && response.request().method() === "PATCH"
  114 |       && response.status() === 200,
  115 |     )
  116 |     await smsToggle.click()
  117 |     const updatedPreference = await (await updatePreferenceResponse).json()
  118 |     await expect(page.getByText(/preferencia actualizada/i)).toBeVisible()
  119 | 
  120 |     const refreshedSettingsResponse = page.waitForResponse((response) =>
  121 |       response.url().includes("/api/customer/notification-preferences/")
  122 |       && response.request().method() === "GET"
  123 |       && response.status() === 200,
```