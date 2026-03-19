import { useCallback, useEffect, useRef, useState } from "react"
import {
  createOwnerInventoryItem,
  createOwnerInventoryMovement,
  createOwnerMenuCategory,
  createOwnerMenuItem,
  createOwnerRestaurantTable,
  deleteOwnerRestaurantTable,
  deleteOwnerMenuCategory,
  deleteOwnerMenuItem,
  getOwnerInventoryItems,
  getOwnerInventoryMetadata,
  getOwnerRestaurantPersonalization,
  getOwnerRestaurantQrs,
  getOwnerRestaurantDashboard,
  getOwnerRestaurantMenu,
  getOwnerRestaurantSettings,
  getOwnerRestaurants,
  getRestaurant,
  getRestaurantMenu,
  getRestaurants,
  updateOwnerInventoryItem,
  updateOwnerRestaurantPersonalization,
  updateOwnerRestaurantSettings,
  updateOwnerRestaurantTable,
  updateOwnerMenuCategory,
  updateOwnerMenuItemAvailability,
  updateOwnerMenuItem,
} from "@/services/restaurants"

function useAsyncState(initialValue) {
  const [data, setData] = useState(initialValue)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  return { data, setData, isLoading, setIsLoading, error, setError }
}

export function useRestaurantList() {
  const state = useAsyncState([])

  useEffect(() => {
    let isMounted = true

    getRestaurants()
      .then((restaurants) => {
        if (!isMounted) {
          return
        }
        state.setData(restaurants)
        state.setError("")
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }
        state.setError(error.message || "No fue posible cargar los restaurantes")
      })
      .finally(() => {
        if (isMounted) {
          state.setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return state
}

export function useRestaurantDetail(slug) {
  const state = useAsyncState(null)

  useEffect(() => {
    let isMounted = true

    state.setIsLoading(true)
    getRestaurant(slug)
      .then((restaurant) => {
        if (!isMounted) {
          return
        }
        state.setData(restaurant)
        state.setError("")
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }
        state.setError(error.message || "No fue posible cargar el restaurante")
      })
      .finally(() => {
        if (isMounted) {
          state.setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [slug])

  return state
}

export function useRestaurantMenu(slug) {
  const state = useAsyncState([])

  useEffect(() => {
    let isMounted = true

    state.setIsLoading(true)
    getRestaurantMenu(slug)
      .then((payload) => {
        if (!isMounted) {
          return
        }
        state.setData(payload.categories || [])
        state.setError("")
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }
        state.setError(error.message || "No fue posible cargar el menu")
      })
      .finally(() => {
        if (isMounted) {
          state.setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [slug])

  return state
}

export function useOwnerRestaurantMenu() {
  const state = useAsyncState({ restaurant: null, categories: [] })

  const loadMenu = useCallback(async () => {
    state.setIsLoading(true)
    state.setError("")

    try {
      const restaurants = await getOwnerRestaurants()
      const restaurant = restaurants[0]

      if (!restaurant) {
        state.setData({ restaurant: null, categories: [] })
        return
      }

      const payload = await getOwnerRestaurantMenu(restaurant.id)
      state.setData({
        restaurant: payload.restaurant,
        categories: payload.categories || [],
      })
    } catch (error) {
      state.setError(error.message || "No fue posible cargar el menu del restaurante")
    } finally {
      state.setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMenu()
  }, [loadMenu])

  const toggleAvailability = useCallback(
    async (menuItemId, isAvailable) => {
      const updated = await updateOwnerMenuItemAvailability(menuItemId, isAvailable)

      state.setData((currentState) => ({
        ...currentState,
        categories: currentState.categories.map((category) => ({
          ...category,
          items: category.items.map((item) =>
            item.id === updated.id ? { ...item, is_available: updated.is_available } : item,
          ),
        })),
      }))

      return updated
    },
    [state],
  )

  return {
    ...state,
    loadMenu,
    toggleAvailability,
    createCategory: async (payload) => {
      const createdCategory = await createOwnerMenuCategory(payload)
      await loadMenu()
      return createdCategory
    },
    updateCategory: async (categoryId, payload) => {
      await updateOwnerMenuCategory(categoryId, payload)
      await loadMenu()
    },
    deleteCategory: async (categoryId) => {
      await deleteOwnerMenuCategory(categoryId)
      await loadMenu()
    },
    createItem: async (payload) => {
      await createOwnerMenuItem(payload)
      await loadMenu()
    },
    updateItem: async (itemId, payload) => {
      await updateOwnerMenuItem(itemId, payload)
      await loadMenu()
    },
    deleteItem: async (itemId) => {
      await deleteOwnerMenuItem(itemId)
      await loadMenu()
    },
  }
}

export function useOwnerRestaurants() {
  const [restaurants, setRestaurants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const loadRestaurants = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getOwnerRestaurants()
      setRestaurants(data)
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar tus restaurantes")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRestaurants()
  }, [loadRestaurants])

  return { restaurants, isLoading, error, reload: loadRestaurants }
}

export function useOwnerInventory(search = "") {
  const [restaurant, setRestaurant] = useState(null)
  const [items, setItems] = useState([])
  const [units, setUnits] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState("")
  const hasLoadedRef = useRef(false)

  const loadInventory = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const restaurants = await getOwnerRestaurants()
      const nextRestaurant = restaurants[0]

      if (!nextRestaurant) {
        setRestaurant(null)
        setItems([])
        setUnits([])
        setError("No se encontro un restaurante asociado a esta cuenta")
        return
      }

      const [inventoryItems, metadata] = await Promise.all([
        getOwnerInventoryItems({ restaurantId: nextRestaurant.id, search }),
        getOwnerInventoryMetadata(),
      ])

      setRestaurant(nextRestaurant)
      setItems(inventoryItems)
      setUnits(metadata.units || [])
      hasLoadedRef.current = true
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar el inventario")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [search])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  return {
    restaurant,
    items,
    units,
    isLoading,
    isRefreshing,
    error,
    reload: loadInventory,
    createItem: async (payload) => {
      const createdItem = await createOwnerInventoryItem(payload)
      await loadInventory()
      return createdItem
    },
    updateItem: async (itemId, payload) => {
      const updatedItem = await updateOwnerInventoryItem(itemId, payload)
      await loadInventory()
      return updatedItem
    },
    registerMovement: async (itemId, payload) => {
      const updatedItem = await createOwnerInventoryMovement(itemId, payload)
      await loadInventory()
      return updatedItem
    },
  }
}

export function useOwnerRestaurantQrs() {
  const [data, setData] = useState({ restaurant: null, menu_qr: null, tables: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState("")
  const hasLoadedRef = useRef(false)

  const loadQrs = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    try {
      const restaurants = await getOwnerRestaurants()
      const restaurant = restaurants[0]
      if (!restaurant) {
        setData({ restaurant: null, menu_qr: null, tables: [] })
        setError("No se encontro un restaurante asociado a esta cuenta")
        return
      }
      const payload = await getOwnerRestaurantQrs(restaurant.id)
      setData(payload)
      hasLoadedRef.current = true
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar los codigos QR")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadQrs()
  }, [loadQrs])

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    createTable: async (payload) => {
      await createOwnerRestaurantTable(data.restaurant.id, payload)
      await loadQrs()
    },
    updateTable: async (tableId, payload) => {
      await updateOwnerRestaurantTable(data.restaurant.id, tableId, payload)
      await loadQrs()
    },
    deleteTable: async (tableId) => {
      await deleteOwnerRestaurantTable(data.restaurant.id, tableId)
      await loadQrs()
    },
  }
}

export function useOwnerRestaurantPersonalization() {
  const [data, setData] = useState(null)
  const [restaurantId, setRestaurantId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const loadPersonalization = useCallback(async () => {
    setIsLoading(true)
    try {
      const restaurants = await getOwnerRestaurants()
      const restaurant = restaurants[0]
      if (!restaurant) {
        setData(null)
        setRestaurantId(null)
        setError("No se encontro un restaurante asociado a esta cuenta")
        return
      }
      setRestaurantId(restaurant.id)
      const payload = await getOwnerRestaurantPersonalization(restaurant.id)
      setData(payload)
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar la personalizacion")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPersonalization()
  }, [loadPersonalization])

  return {
    data,
    restaurantId,
    isLoading,
    isSaving,
    error,
    reload: loadPersonalization,
    savePersonalization: async (payload) => {
      if (!restaurantId) {
        throw new Error("No se encontro restaurante para actualizar")
      }

      setIsSaving(true)
      try {
        const updated = await updateOwnerRestaurantPersonalization(restaurantId, payload)
        setData(updated)
        return updated
      } finally {
        setIsSaving(false)
      }
    },
  }
}

export function useOwnerRestaurantDashboard(orderScope = "all") {
  const state = useAsyncState({
    restaurant: null,
    metrics: {
      sales_today: 0,
      orders_today: 0,
      new_customers_this_week: 0,
      monthly_sales: 0,
      new_orders_count: 0,
    },
    recent_orders: [],
    top_products: [],
  })

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      state.setIsLoading(true)
      try {
        const restaurants = await getOwnerRestaurants()
        const restaurant = restaurants[0]

        if (!restaurant) {
          if (isMounted) {
            state.setData({
              restaurant: null,
              metrics: {
                sales_today: 0,
                orders_today: 0,
                new_customers_this_week: 0,
                monthly_sales: 0,
                new_orders_count: 0,
              },
              recent_orders: [],
              top_products: [],
            })
          }
          return
        }

        const dashboard = await getOwnerRestaurantDashboard(restaurant.id, orderScope)
        if (isMounted) {
          state.setData(dashboard)
          state.setError("")
        }
      } catch (error) {
        if (isMounted) {
          state.setError(error.message || "No fue posible cargar el dashboard del restaurante")
        }
      } finally {
        if (isMounted) {
          state.setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [orderScope])

  return state
}

export function useOwnerRestaurantSettings() {
  const [data, setData] = useState(null)
  const [restaurantId, setRestaurantId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const restaurants = await getOwnerRestaurants()
      const restaurant = restaurants[0]
      if (!restaurant) {
        setData(null)
        setRestaurantId(null)
        setError("No se encontro un restaurante asociado a esta cuenta")
        return
      }
      setRestaurantId(restaurant.id)
      const payload = await getOwnerRestaurantSettings(restaurant.id)
      setData(payload)
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar la configuracion")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return {
    data,
    restaurantId,
    isLoading,
    isSaving,
    error,
    reload: loadSettings,
    saveSettings: async (payload) => {
      if (!restaurantId) {
        throw new Error("No se encontro restaurante para actualizar")
      }
      setIsSaving(true)
      try {
        const updated = await updateOwnerRestaurantSettings(restaurantId, payload)
        setData(updated)
        return updated
      } finally {
        setIsSaving(false)
      }
    },
  }
}
