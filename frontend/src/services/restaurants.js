import { apiJson } from "@/lib/api"

function buildMenuItemFormData(payload) {
  const formData = new FormData()

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || (value === "" && key !== "description")) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry === undefined || entry === null || entry === "") {
          return
        }
        formData.append(key, entry)
      })
      return
    }

    if (typeof value === "boolean") {
      if (!value) {
        return
      }
      formData.append(key, "true")
      return
    }

    formData.append(key, value)
  })

  return formData
}

function buildPersonalizationFormData(payload) {
  const formData = new FormData()

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }

    if (typeof value === "boolean") {
      formData.append(key, value ? "true" : "false")
      return
    }

    formData.append(key, value)
  })

  return formData
}

export function getRestaurants() {
  return apiJson("/api/restaurants/", {}, false)
}

export function getRestaurant(slug) {
  return apiJson(`/api/restaurants/${slug}/`, {}, false)
}

export function getRestaurantMenu(slug) {
  return apiJson(`/api/restaurants/${slug}/menu/`, {}, false)
}

export function getOwnerRestaurants() {
  return apiJson("/api/owner/restaurants/")
}

export function getOwnerRestaurantMenu(restaurantId) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/menu/`)
}

export function getOwnerRestaurantDashboard(restaurantId) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/dashboard/`)
}

export function getOwnerRestaurantSettings(restaurantId) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/settings/`)
}

export function updateOwnerRestaurantSettings(restaurantId, payload) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/settings/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function updateOwnerMenuItemAvailability(menuItemId, isAvailable) {
  return apiJson(`/api/owner/menu-items/${menuItemId}/availability/`, {
    method: "PATCH",
    body: JSON.stringify({ is_available: isAvailable }),
  })
}

export function createOwnerMenuCategory(payload) {
  return apiJson("/api/owner/menu-categories/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getOwnerMenuCategories({ restaurantId, search = "", limit } = {}) {
  const params = new URLSearchParams()

  if (restaurantId) {
    params.set("restaurant", restaurantId)
  }

  if (search) {
    params.set("search", search)
  }

  if (limit) {
    params.set("limit", String(limit))
  }

  const queryString = params.toString()
  return apiJson(`/api/owner/menu-categories/${queryString ? `?${queryString}` : ""}`)
}

export function updateOwnerMenuCategory(categoryId, payload) {
  return apiJson(`/api/owner/menu-categories/${categoryId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function deleteOwnerMenuCategory(categoryId) {
  return apiJson(`/api/owner/menu-categories/${categoryId}/`, {
    method: "DELETE",
    headers: {},
  })
}

export function createOwnerMenuItem(payload) {
  return apiJson("/api/owner/menu-crud-items/", {
    method: "POST",
    body: buildMenuItemFormData(payload),
  })
}

export function updateOwnerMenuItem(menuItemId, payload) {
  return apiJson(`/api/owner/menu-crud-items/${menuItemId}/`, {
    method: "PATCH",
    body: buildMenuItemFormData(payload),
  })
}

export function getOwnerInventoryItems({ restaurantId, search = "" } = {}) {
  const params = new URLSearchParams()

  if (restaurantId) {
    params.set("restaurant", restaurantId)
  }

  if (search) {
    params.set("search", search)
  }

  const queryString = params.toString()
  return apiJson(`/api/owner/inventory-items/${queryString ? `?${queryString}` : ""}`)
}

export function getOwnerInventoryMetadata() {
  return apiJson("/api/owner/inventory-metadata/")
}

export function createOwnerInventoryItem(payload) {
  return apiJson("/api/owner/inventory-items/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateOwnerInventoryItem(itemId, payload) {
  return apiJson(`/api/owner/inventory-items/${itemId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function createOwnerInventoryMovement(itemId, payload) {
  return apiJson(`/api/owner/inventory-items/${itemId}/movements/`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getOwnerRestaurantQrs(restaurantId) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/qrs/`)
}

export function createOwnerRestaurantTable(restaurantId, payload) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/tables/`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateOwnerRestaurantTable(restaurantId, tableId, payload) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/tables/${tableId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function deleteOwnerRestaurantTable(restaurantId, tableId) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/tables/${tableId}/`, {
    method: "DELETE",
    headers: {},
  })
}

export function getOwnerRestaurantPersonalization(restaurantId) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/personalization/`)
}

export function updateOwnerRestaurantPersonalization(restaurantId, payload) {
  return apiJson(`/api/owner/restaurants/${restaurantId}/personalization/`, {
    method: "PATCH",
    body: buildPersonalizationFormData(payload),
  })
}

export function deleteOwnerMenuItem(menuItemId) {
  return apiJson(`/api/owner/menu-crud-items/${menuItemId}/`, {
    method: "DELETE",
    headers: {},
  })
}
