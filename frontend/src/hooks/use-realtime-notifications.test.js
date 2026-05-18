import { describe, expect, it } from "vitest"
import { toastMessageForEvent } from "@/hooks/use-realtime-notifications"

describe("toastMessageForEvent", () => {
  it("builds loyalty points earned message", () => {
    const message = { event_type: "loyalty.points_earned" }
    const payload = { points: 12, restaurant_name: "La Brasa" }

    expect(toastMessageForEvent(message, payload)).toBe("Sumaste 12 puntos en La Brasa")
  })

  it("builds order status changed message", () => {
    const message = { event_type: "order.status_changed" }
    const payload = { order_code: "ORD-0004", status_name: "Completado" }

    expect(toastMessageForEvent(message, payload)).toBe("Pedido ORD-0004: Completado")
  })
})
