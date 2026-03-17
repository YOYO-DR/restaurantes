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

export function getCustomerDashboard() {
  return apiJson("/api/customer/dashboard/")
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

export function getCustomerLoyalty() {
  return apiJson("/api/customer/loyalty/")
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

export function getOwnerCustomers(restaurantId) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/customers/`)
}

export function getOwnerAnalytics(restaurantId) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/analytics/`)
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
