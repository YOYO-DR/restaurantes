# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: checkout-delivery.test.js >> Checkout delivery - usuario autenticado con direcciones existentes >> confirmar pedido deshabilitado hasta seleccionar una direccion
- Location: e2e/checkout-delivery.test.js:298:3

# Error details

```
Error: Channel closed
```

```
Error: page.waitForSelector: Target page, context or browser has been closed
Call log:
  - waiting for locator('h1') to be visible

```

```
Error: browserContext.close: Target page, context or browser has been closed
```