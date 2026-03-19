import { apiJson } from "@/lib/api"

export function getAdminDashboard(orderScope = "all") {
  const params = new URLSearchParams()
  if (orderScope && orderScope !== "all") {
    params.set("order_scope", orderScope)
  }
  const queryString = params.toString()
  return apiJson(`/api/admin/dashboard/${queryString ? `?${queryString}` : ""}`)
}

export function getAdminUsers({
  page = 1,
  pageSize = 10,
  ordering = "-joined_at",
  name = "",
  email = "",
  phone = "",
  role = "",
  status = "",
  ordersCount = "",
  joinedAt = "",
} = {}) {
  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("page_size", String(pageSize))
  params.set("ordering", ordering)
  if (name) params.set("name", name)
  if (email) params.set("email", email)
  if (phone) params.set("phone", phone)
  if (role && role !== "todos") {
    params.set("role", role)
  }
  if (status && status !== "todos") params.set("status", status)
  if (ordersCount) params.set("orders_count", ordersCount)
  if (joinedAt) params.set("joined_at", joinedAt)

  const queryString = params.toString()
  return apiJson(`/api/admin/users/${queryString ? `?${queryString}` : ""}`)
}

export function getAdminRestaurants({
  page = 1,
  pageSize = 10,
  ordering = "-joined_at",
  name = "",
  owner = "",
  category = "",
  status = "",
  subscriptionPlan = "",
  ordersCount = "",
  revenue = "",
  joinedAt = "",
} = {}) {
  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("page_size", String(pageSize))
  params.set("ordering", ordering)
  if (name) params.set("name", name)
  if (owner) params.set("owner", owner)
  if (category) params.set("category", category)
  if (status && status !== "todos") {
    params.set("status", status)
  }
  if (subscriptionPlan) params.set("subscription_plan", subscriptionPlan)
  if (ordersCount) params.set("orders_count", ordersCount)
  if (revenue) params.set("revenue", revenue)
  if (joinedAt) params.set("joined_at", joinedAt)

  const queryString = params.toString()
  return apiJson(`/api/admin/restaurants/${queryString ? `?${queryString}` : ""}`)
}

export function getAdminRestaurant(restaurantId) {
  return apiJson(`/api/admin/restaurants/${restaurantId}/`)
}

export function updateAdminRestaurant(restaurantId, payload) {
  return apiJson(`/api/admin/restaurants/${restaurantId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function getAdminReports() {
  return apiJson("/api/admin/reports/")
}

export function getAdminSettings() {
  return apiJson("/api/admin/settings/")
}

export function updateAdminSettings(payload) {
  return apiJson("/api/admin/settings/_/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}
