import { test, expect } from "@playwright/test"

const RESTAURANT = {
  id: "rest-1",
  name: "La Parrilla",
  slug: "la-parrilla",
  delivery_fee_amount: "5000",
  estimated_min_minutes: 30,
  estimated_max_minutes: 45,
}

const MENU_ITEM = {
  id: "item-1",
  name: "Hamburguesa",
  price: 25000,
  currency: "COP",
  quantity: 1,
}

const CART_STATE = {
  items: [MENU_ITEM],
  restaurant: RESTAURANT,
  orderType: "delivery",
  tableId: null,
  tableNumber: null,
}

const ADDRESS_1 = {
  id: "addr-1",
  label: "Casa",
  line1: "Calle 5 #12-34",
  city: "Corinto",
  country: "Colombia",
  notes: "Casa blanca",
  is_default: true,
  address_type: "home-type-id",
  address_type_code: "home",
}

const CREATED_ADDRESS = {
  id: "addr-new",
  label: "Nueva Casa",
  line1: "Carrera 10 #20-30",
  city: "Bogota",
  country: "Colombia",
  notes: "",
  is_default: false,
  address_type: "home-type-id",
  address_type_code: "home",
}

function injectCart(page, cartState) {
  return page.addInitScript((state) => {
    window.localStorage.setItem("cart", JSON.stringify(state))
  }, cartState)
}

function mockRefreshAs401(page) {
  return page.route("**/api/auth/refresh/", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "Unauthorized" }) }),
  )
}

async function gotoCheckout(page) {
  await page.goto("/checkout", { waitUntil: "domcontentloaded" })
  await page.waitForSelector("h1", { timeout: 10000 })
}

test.describe("Checkout delivery - usuario no autenticado (guest)", () => {
  test.beforeEach(async ({ page }) => {
    await mockRefreshAs401(page)
    await injectCart(page, CART_STATE)
    await page.route("**/api/auth/me/", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "Unauthorized" }) }),
    )
  })

  test("muestra formulario de datos de contacto con campo de direccion en modo delivery", async ({ page }) => {
    await gotoCheckout(page)

    await expect(page.getByLabel(/nombre/i)).toBeVisible()
    await expect(page.getByLabel(/correo/i)).toBeVisible()
    await expect(page.getByLabel(/telefono/i)).toBeVisible()
    await expect(page.getByLabel(/direccion/i)).toBeVisible()
  })

  test("boton confirmar deshabilitado sin datos completos", async ({ page }) => {
    await gotoCheckout(page)

    const confirmBtn = page.getByRole("button", { name: /confirmar pedido/i })
    await expect(confirmBtn).toBeDisabled()
  })

  test("boton confirmar se habilita al llenar todos los campos requeridos", async ({ page }) => {
    await page.route("**/api/checkout/orders/", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "order-1", order_code: "ORD-001", guest_tracking_code: "TRK-001" }),
      }),
    )

    await gotoCheckout(page)

    await page.getByLabel(/nombre/i).fill("Juan Perez")
    await page.getByLabel(/correo/i).fill("juan@example.com")
    await page.getByLabel(/telefono/i).fill("3001234567")
    await page.getByLabel(/direccion/i).fill("Calle 5 #12-34, Corinto")

    const confirmBtn = page.getByRole("button", { name: /confirmar pedido/i })
    await expect(confirmBtn).toBeEnabled()
  })

  test("boton confirmar deshabilitado si solo falta la direccion de entrega", async ({ page }) => {
    await gotoCheckout(page)

    await page.getByLabel(/nombre/i).fill("Juan Perez")
    await page.getByLabel(/correo/i).fill("juan@example.com")
    await page.getByLabel(/telefono/i).fill("3001234567")

    const confirmBtn = page.getByRole("button", { name: /confirmar pedido/i })
    await expect(confirmBtn).toBeDisabled()
  })

  test("confirmar pedido como guest completa el flujo correctamente", async ({ page }) => {
    await page.route("**/api/checkout/orders/", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "order-1", order_code: "ORD-001", guest_tracking_code: "TRK-001" }),
      }),
    )

    await gotoCheckout(page)

    await page.getByLabel(/nombre/i).fill("Juan Perez")
    await page.getByLabel(/correo/i).fill("juan@example.com")
    await page.getByLabel(/telefono/i).fill("3001234567")
    await page.getByLabel(/direccion/i).fill("Calle 5 #12-34, Corinto")

    await page.getByRole("button", { name: /confirmar pedido/i }).click()

    await expect(page).toHaveURL(/\/mis-pedidos/, { timeout: 10000 })
  })
})

test.describe("Checkout delivery - usuario autenticado sin direcciones previas", () => {
  test.beforeEach(async ({ page }) => {
    await injectCart(page, CART_STATE)
    await page.route("**/api/auth/refresh/", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: "mock-token" }),
      }),
    )
    await page.route("**/api/auth/me/", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "user-1", name: "Maria", email: "maria@example.com", role: "cliente" }),
      }),
    )
    await page.route("**/api/customer/addresses/", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
      } else if (route.request().method() === "POST") {
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(CREATED_ADDRESS) })
      } else {
        await route.continue()
      }
    })
  })

  test("muestra formulario de nueva direccion cuando no hay direcciones guardadas", async ({ page }) => {
    await gotoCheckout(page)

    await expect(page.getByText(/direccion de entrega/i)).toBeVisible()
    await expect(page.getByPlaceholder(/casa/i)).toBeVisible()
    await expect(page.getByPlaceholder(/calle 5/i)).toBeVisible()
    await expect(page.getByPlaceholder(/corinto/i)).toBeVisible()
  })

  test("boton guardar direccion deshabilitado con campos vacios", async ({ page }) => {
    await gotoCheckout(page)

    const saveBtn = page.getByRole("button", { name: /guardar nueva direccion/i })
    await expect(saveBtn).toBeDisabled()
  })

  test("boton guardar se habilita al llenar nombre, calle y ciudad", async ({ page }) => {
    await gotoCheckout(page)

    await page.getByPlaceholder(/casa/i).fill("Mi Casa")
    await page.getByPlaceholder(/calle 5/i).fill("Carrera 10 #20-30")
    await page.getByPlaceholder(/corinto/i).fill("Bogota")

    const saveBtn = page.getByRole("button", { name: /guardar nueva direccion/i })
    await expect(saveBtn).toBeEnabled()
  })

  test("guardar nueva direccion auto-selecciona y habilita confirmar pedido", async ({ page }) => {
    await page.route("**/api/customer/addresses/", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([CREATED_ADDRESS]) })
      } else if (route.request().method() === "POST") {
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(CREATED_ADDRESS) })
      } else {
        await route.continue()
      }
    })
    await page.route("**/api/checkout/orders/", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "order-1", order_code: "ORD-001" }),
      }),
    )

    await gotoCheckout(page)

    await page.getByPlaceholder(/casa/i).fill("Nueva Casa")
    await page.getByPlaceholder(/calle 5/i).fill("Carrera 10 #20-30")
    await page.getByPlaceholder(/corinto/i).fill("Bogota")

    await page.getByRole("button", { name: /guardar nueva direccion/i }).click()

    const confirmBtn = page.getByRole("button", { name: /confirmar pedido/i })
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 })
  })

  test("confirmar pedido con nueva direccion completa el flujo", async ({ page }) => {
    await page.route("**/api/customer/addresses/", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([CREATED_ADDRESS]) })
      } else if (route.request().method() === "POST") {
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(CREATED_ADDRESS) })
      } else {
        await route.continue()
      }
    })
    await page.route("**/api/checkout/orders/", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "order-1", order_code: "ORD-001" }),
      }),
    )

    await gotoCheckout(page)

    await page.getByPlaceholder(/casa/i).fill("Nueva Casa")
    await page.getByPlaceholder(/calle 5/i).fill("Carrera 10 #20-30")
    await page.getByPlaceholder(/corinto/i).fill("Bogota")

    await page.getByRole("button", { name: /guardar nueva direccion/i }).click()
    await expect(page.getByRole("button", { name: /confirmar pedido/i })).toBeEnabled({ timeout: 5000 })

    await page.getByRole("button", { name: /confirmar pedido/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/cliente\/pedidos/, { timeout: 10000 })
  })
})

test.describe("Checkout delivery - usuario autenticado con direcciones existentes", () => {
  test.beforeEach(async ({ page }) => {
    await injectCart(page, CART_STATE)
    await page.route("**/api/auth/refresh/", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: "mock-token" }),
      }),
    )
    await page.route("**/api/auth/me/", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "user-1", name: "Maria", email: "maria@example.com", role: "cliente" }),
      }),
    )
    await page.route("**/api/customer/addresses/", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([ADDRESS_1]) })
      } else {
        await route.continue()
      }
    })
  })

  test("muestra direcciones guardadas del usuario", async ({ page }) => {
    await gotoCheckout(page)

    await expect(page.getByText("Casa")).toBeVisible()
    await expect(page.getByText("Calle 5 #12-34")).toBeVisible()
    await expect(page.getByText("Corinto")).toBeVisible()
  })

  test("confirmar pedido deshabilitado hasta seleccionar una direccion", async ({ page }) => {
    await gotoCheckout(page)

    const confirmBtn = page.getByRole("button", { name: /confirmar pedido/i })
    await expect(confirmBtn).toBeDisabled()
  })

  test("seleccionar direccion existente habilita confirmar pedido", async ({ page }) => {
    await page.route("**/api/checkout/orders/", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "order-1", order_code: "ORD-001" }),
      }),
    )

    await gotoCheckout(page)

    await page.getByText("Calle 5 #12-34").click()

    const confirmBtn = page.getByRole("button", { name: /confirmar pedido/i })
    await expect(confirmBtn).toBeEnabled()
  })

  test("confirmar pedido con direccion existente completa el flujo", async ({ page }) => {
    await page.route("**/api/checkout/orders/", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "order-1", order_code: "ORD-001" }),
      }),
    )

    await gotoCheckout(page)

    await page.getByText("Calle 5 #12-34").click()
    await page.getByRole("button", { name: /confirmar pedido/i }).click()

    await expect(page).toHaveURL(/\/dashboard\/cliente\/pedidos/, { timeout: 10000 })
  })
})
