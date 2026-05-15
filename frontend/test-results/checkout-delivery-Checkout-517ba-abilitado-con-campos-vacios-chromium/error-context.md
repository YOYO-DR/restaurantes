# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: checkout-delivery.test.js >> Checkout delivery - usuario autenticado sin direcciones previas >> boton guardar direccion deshabilitado con campos vacios
- Location: e2e/checkout-delivery.test.js:184:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

# Test source

```ts
  48  |   address_type: "home-type-id",
  49  |   address_type_code: "home",
  50  | }
  51  | 
  52  | function injectCart(page, cartState) {
  53  |   return page.addInitScript((state) => {
  54  |     window.localStorage.setItem("cart", JSON.stringify(state))
  55  |   }, cartState)
  56  | }
  57  | 
  58  | function mockRefreshAs401(page) {
  59  |   return page.route("**/api/auth/refresh/", (route) =>
  60  |     route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "Unauthorized" }) }),
  61  |   )
  62  | }
  63  | 
  64  | async function gotoCheckout(page) {
  65  |   await page.goto("/checkout", { waitUntil: "domcontentloaded" })
  66  |   await page.waitForSelector("h1", { timeout: 10000 })
  67  | }
  68  | 
  69  | test.describe("Checkout delivery - usuario no autenticado (guest)", () => {
  70  |   test.beforeEach(async ({ page }) => {
  71  |     await mockRefreshAs401(page)
  72  |     await injectCart(page, CART_STATE)
  73  |     await page.route("**/api/auth/me/", (route) =>
  74  |       route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "Unauthorized" }) }),
  75  |     )
  76  |   })
  77  | 
  78  |   test("muestra formulario de datos de contacto con campo de direccion en modo delivery", async ({ page }) => {
  79  |     await gotoCheckout(page)
  80  | 
  81  |     await expect(page.getByLabel(/nombre/i)).toBeVisible()
  82  |     await expect(page.getByLabel(/correo/i)).toBeVisible()
  83  |     await expect(page.getByLabel(/telefono/i)).toBeVisible()
  84  |     await expect(page.getByLabel(/direccion/i)).toBeVisible()
  85  |   })
  86  | 
  87  |   test("boton confirmar deshabilitado sin datos completos", async ({ page }) => {
  88  |     await gotoCheckout(page)
  89  | 
  90  |     const confirmBtn = page.getByRole("button", { name: /confirmar pedido/i })
  91  |     await expect(confirmBtn).toBeDisabled()
  92  |   })
  93  | 
  94  |   test("boton confirmar se habilita al llenar todos los campos requeridos", async ({ page }) => {
  95  |     await page.route("**/api/checkout/orders/", (route) =>
  96  |       route.fulfill({
  97  |         status: 201,
  98  |         contentType: "application/json",
  99  |         body: JSON.stringify({ id: "order-1", order_code: "ORD-001", guest_tracking_code: "TRK-001" }),
  100 |       }),
  101 |     )
  102 | 
  103 |     await gotoCheckout(page)
  104 | 
  105 |     await page.getByLabel(/nombre/i).fill("Juan Perez")
  106 |     await page.getByLabel(/correo/i).fill("juan@example.com")
  107 |     await page.getByLabel(/telefono/i).fill("3001234567")
  108 |     await page.getByLabel(/direccion/i).fill("Calle 5 #12-34, Corinto")
  109 | 
  110 |     const confirmBtn = page.getByRole("button", { name: /confirmar pedido/i })
  111 |     await expect(confirmBtn).toBeEnabled()
  112 |   })
  113 | 
  114 |   test("boton confirmar deshabilitado si solo falta la direccion de entrega", async ({ page }) => {
  115 |     await gotoCheckout(page)
  116 | 
  117 |     await page.getByLabel(/nombre/i).fill("Juan Perez")
  118 |     await page.getByLabel(/correo/i).fill("juan@example.com")
  119 |     await page.getByLabel(/telefono/i).fill("3001234567")
  120 | 
  121 |     const confirmBtn = page.getByRole("button", { name: /confirmar pedido/i })
  122 |     await expect(confirmBtn).toBeDisabled()
  123 |   })
  124 | 
  125 |   test("confirmar pedido como guest completa el flujo correctamente", async ({ page }) => {
  126 |     await page.route("**/api/checkout/orders/", (route) =>
  127 |       route.fulfill({
  128 |         status: 201,
  129 |         contentType: "application/json",
  130 |         body: JSON.stringify({ id: "order-1", order_code: "ORD-001", guest_tracking_code: "TRK-001" }),
  131 |       }),
  132 |     )
  133 | 
  134 |     await gotoCheckout(page)
  135 | 
  136 |     await page.getByLabel(/nombre/i).fill("Juan Perez")
  137 |     await page.getByLabel(/correo/i).fill("juan@example.com")
  138 |     await page.getByLabel(/telefono/i).fill("3001234567")
  139 |     await page.getByLabel(/direccion/i).fill("Calle 5 #12-34, Corinto")
  140 | 
  141 |     await page.getByRole("button", { name: /confirmar pedido/i }).click()
  142 | 
  143 |     await expect(page).toHaveURL(/\/mis-pedidos/, { timeout: 10000 })
  144 |   })
  145 | })
  146 | 
  147 | test.describe("Checkout delivery - usuario autenticado sin direcciones previas", () => {
> 148 |   test.beforeEach(async ({ page }) => {
      |        ^ Test timeout of 30000ms exceeded while running "beforeEach" hook.
  149 |     await injectCart(page, CART_STATE)
  150 |     await page.route("**/api/auth/refresh/", (route) =>
  151 |       route.fulfill({
  152 |         status: 200,
  153 |         contentType: "application/json",
  154 |         body: JSON.stringify({ access: "mock-token" }),
  155 |       }),
  156 |     )
  157 |     await page.route("**/api/auth/me/", (route) =>
  158 |       route.fulfill({
  159 |         status: 200,
  160 |         contentType: "application/json",
  161 |         body: JSON.stringify({ id: "user-1", name: "Maria", email: "maria@example.com", role: "cliente" }),
  162 |       }),
  163 |     )
  164 |     await page.route("**/api/customer/addresses/", async (route) => {
  165 |       if (route.request().method() === "GET") {
  166 |         await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
  167 |       } else if (route.request().method() === "POST") {
  168 |         await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(CREATED_ADDRESS) })
  169 |       } else {
  170 |         await route.continue()
  171 |       }
  172 |     })
  173 |   })
  174 | 
  175 |   test("muestra formulario de nueva direccion cuando no hay direcciones guardadas", async ({ page }) => {
  176 |     await gotoCheckout(page)
  177 | 
  178 |     await expect(page.getByText(/direccion de entrega/i)).toBeVisible()
  179 |     await expect(page.getByPlaceholder(/casa/i)).toBeVisible()
  180 |     await expect(page.getByPlaceholder(/calle 5/i)).toBeVisible()
  181 |     await expect(page.getByPlaceholder(/corinto/i)).toBeVisible()
  182 |   })
  183 | 
  184 |   test("boton guardar direccion deshabilitado con campos vacios", async ({ page }) => {
  185 |     await gotoCheckout(page)
  186 | 
  187 |     const saveBtn = page.getByRole("button", { name: /guardar nueva direccion/i })
  188 |     await expect(saveBtn).toBeDisabled()
  189 |   })
  190 | 
  191 |   test("boton guardar se habilita al llenar nombre, calle y ciudad", async ({ page }) => {
  192 |     await gotoCheckout(page)
  193 | 
  194 |     await page.getByPlaceholder(/casa/i).fill("Mi Casa")
  195 |     await page.getByPlaceholder(/calle 5/i).fill("Carrera 10 #20-30")
  196 |     await page.getByPlaceholder(/corinto/i).fill("Bogota")
  197 | 
  198 |     const saveBtn = page.getByRole("button", { name: /guardar nueva direccion/i })
  199 |     await expect(saveBtn).toBeEnabled()
  200 |   })
  201 | 
  202 |   test("guardar nueva direccion auto-selecciona y habilita confirmar pedido", async ({ page }) => {
  203 |     await page.route("**/api/customer/addresses/", async (route) => {
  204 |       if (route.request().method() === "GET") {
  205 |         await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([CREATED_ADDRESS]) })
  206 |       } else if (route.request().method() === "POST") {
  207 |         await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(CREATED_ADDRESS) })
  208 |       } else {
  209 |         await route.continue()
  210 |       }
  211 |     })
  212 |     await page.route("**/api/checkout/orders/", (route) =>
  213 |       route.fulfill({
  214 |         status: 201,
  215 |         contentType: "application/json",
  216 |         body: JSON.stringify({ id: "order-1", order_code: "ORD-001" }),
  217 |       }),
  218 |     )
  219 | 
  220 |     await gotoCheckout(page)
  221 | 
  222 |     await page.getByPlaceholder(/casa/i).fill("Nueva Casa")
  223 |     await page.getByPlaceholder(/calle 5/i).fill("Carrera 10 #20-30")
  224 |     await page.getByPlaceholder(/corinto/i).fill("Bogota")
  225 | 
  226 |     await page.getByRole("button", { name: /guardar nueva direccion/i }).click()
  227 | 
  228 |     const confirmBtn = page.getByRole("button", { name: /confirmar pedido/i })
  229 |     await expect(confirmBtn).toBeEnabled({ timeout: 5000 })
  230 |   })
  231 | 
  232 |   test("confirmar pedido con nueva direccion completa el flujo", async ({ page }) => {
  233 |     await page.route("**/api/customer/addresses/", async (route) => {
  234 |       if (route.request().method() === "GET") {
  235 |         await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([CREATED_ADDRESS]) })
  236 |       } else if (route.request().method() === "POST") {
  237 |         await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(CREATED_ADDRESS) })
  238 |       } else {
  239 |         await route.continue()
  240 |       }
  241 |     })
  242 |     await page.route("**/api/checkout/orders/", (route) =>
  243 |       route.fulfill({
  244 |         status: 201,
  245 |         contentType: "application/json",
  246 |         body: JSON.stringify({ id: "order-1", order_code: "ORD-001" }),
  247 |       }),
  248 |     )
```