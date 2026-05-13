import { apiJson } from "@/lib/api"

export function getCustomerAddresses() {
  return apiJson("/api/customer/addresses/")
}

export function createCustomerAddress(payload) {
  return apiJson("/api/customer/addresses/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateCustomerAddress(addressId, payload) {
  return apiJson(`/api/customer/addresses/${addressId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function deleteCustomerAddress(addressId) {
  return apiJson(`/api/customer/addresses/${addressId}/`, {
    method: "DELETE",
    headers: {},
  })
}

export function getCustomerDashboard(orderScope = "all") {
  const params = new URLSearchParams()
  if (orderScope && orderScope !== "all") {
    params.set("order_scope", orderScope)
  }
  const queryString = params.toString()
  return apiJson(`/api/customer/dashboard/${queryString ? `?${queryString}` : ""}`)
}

export function getCustomerFavorites() {
  return apiJson("/api/customer/favorites/")
}

export function deleteCustomerFavorite(favoriteId) {
  return apiJson(`/api/customer/favorites/${favoriteId}/`, {
    method: "DELETE",
    headers: {},
  })
}

export function getCustomerLoyalty(restaurantId) {
  const params = new URLSearchParams()
  if (restaurantId) {
    params.set("restaurant_id", restaurantId)
  }
  const queryString = params.toString()
  return apiJson(`/api/customer/loyalty/${queryString ? `?${queryString}` : ""}`)
}

export function getCustomerNotificationPreferences() {
  return apiJson("/api/customer/notification-preferences/")
}

export function updateCustomerNotificationPreference(preferenceId, payload) {
  return apiJson(`/api/customer/notification-preferences/${preferenceId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function getCustomerPaymentMethods() {
  return apiJson("/api/customer/payment-methods/")
}

export function createCustomerPaymentMethod(payload) {
  return apiJson("/api/customer/payment-methods/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function deleteCustomerPaymentMethod(paymentMethodId) {
  return apiJson(`/api/customer/payment-methods/${paymentMethodId}/`, {
    method: "DELETE",
    headers: {},
  })
}

export function getNotificationCenter() {
  return apiJson("/api/notifications/center/")
}

export function createNotificationEvent(payload) {
  return apiJson("/api/notifications/center/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function markAllNotificationsRead() {
  return apiJson("/api/notifications/center/mark-all-read/", {
    method: "PATCH",
    body: JSON.stringify({}),
  })
}

export function getAccountProfile() {
  return apiJson("/api/account/profile/")
}

export function updateAccountProfile(payload) {
  return apiJson("/api/account/profile/_/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function getCustomerOrders() {
  return apiJson("/api/customer/orders/")
}

export function createCheckoutOrder(payload) {
  return apiJson("/api/checkout/orders/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getGuestOrder(trackingCode) {
  return apiJson(`/api/checkout/orders/guest/${trackingCode}/`)
}

export function getCheckoutOrderStatus(orderId) {
  return apiJson(`/api/checkout/orders/${orderId}/status/`)
}

export function getOwnerOrders() {
  return apiJson("/api/owner/orders/")
}

export function updateOwnerOrderStatus(orderId, statusCode) {
  return apiJson(`/api/owner/orders/${orderId}/status/`, {
    method: "PATCH",
    body: JSON.stringify({ status_code: statusCode }),
  })
}

export function cancelOwnerOrder(orderId, reason = "") {
  return apiJson(`/api/owner/orders/${orderId}/cancel/`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  })
}

export function cancelCheckoutOrder(orderId, reason = "") {
  return apiJson(`/api/checkout/orders/${orderId}/cancel/`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  })
}

export function getOwnerCustomers(restaurantId, orderScope = "all") {
  const params = new URLSearchParams()
  if (orderScope && orderScope !== "all") {
    params.set("order_scope", orderScope)
  }
  const queryString = params.toString()
  return apiJson(`/api/owner/restaurants/${restaurantId}/customers/${queryString ? `?${queryString}` : ""}`)
}

export function getOwnerAnalytics(restaurantId, orderScope = "all") {
  const params = new URLSearchParams()
  if (orderScope && orderScope !== "all") {
    params.set("order_scope", orderScope)
  }
  const queryString = params.toString()
  return apiJson(`/api/owner/restaurants/${restaurantId}/analytics/${queryString ? `?${queryString}` : ""}`)
}

export function getOwnerReviews(restaurantId) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/reviews/`)
}

export function replyOwnerReview(restaurantId, reviewId, response) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/reviews/${reviewId}/reply/`, {
    method: "POST",
    body: JSON.stringify({ response }),
  })
}
