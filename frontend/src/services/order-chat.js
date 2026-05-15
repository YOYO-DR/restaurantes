import { apiJson, API_BASE_URL, getAccessToken } from "@/lib/api"

function toQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return
    }
    search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ""
}

export function getOrderContactInfo(orderId, { trackingCode } = {}) {
  return apiJson(`/api/orders/${orderId}/contact-info/${toQuery({ tracking_code: trackingCode })}`)
}

export function getOrderChat(orderId, { trackingCode } = {}) {
  return apiJson(`/api/orders/${orderId}/chat/${toQuery({ tracking_code: trackingCode })}`)
}

export function markOrderChatRead(orderId, { trackingCode } = {}) {
  const payload = trackingCode ? { tracking_code: trackingCode } : {}
  return apiJson(`/api/orders/${orderId}/chat/read/`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function sendOrderChatMessage(orderId, { body, image, trackingCode } = {}) {
  const formData = new FormData()
  if (typeof body === "string" && body.trim()) {
    formData.append("body", body.trim())
  }
  if (image instanceof File) {
    formData.append("image", image)
  }
  if (trackingCode) {
    formData.append("tracking_code", trackingCode)
  }

  return apiJson(`/api/orders/${orderId}/chat/messages/`, {
    method: "POST",
    body: formData,
  })
}

export function getPlatformChatConfig() {
  return apiJson("/api/platform/chat-config/")
}

export function buildOrderChatSocketUrl(orderId, { accessToken, trackingCode } = {}) {
  const apiUrl = new URL(API_BASE_URL)
  const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:"
  const params = new URLSearchParams()

  const token = accessToken || getAccessToken()
  if (token) {
    params.set("access_token", token)
  }
  if (trackingCode) {
    params.set("tracking_code", trackingCode)
  }

  const query = params.toString()
  return `${protocol}//${apiUrl.host}/api/ws/orders/${orderId}/chat/${query ? `?${query}` : ""}`
}
