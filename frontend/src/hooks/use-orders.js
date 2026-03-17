import { useCallback, useEffect, useState } from "react"
import {
  cancelCheckoutOrder,
  cancelOwnerOrder,
  createCheckoutOrder,
  createCustomerAddress,
  deleteCustomerAddress,
  deleteCustomerFavorite,
  getAccountProfile,
  getCheckoutOrderStatus,
  getGuestOrder,
  getOwnerReviews,
  getCustomerDashboard,
  getCustomerAddresses,
  getCustomerFavorites,
  getCustomerLoyalty,
  getCustomerOrders,
  getOwnerAnalytics,
  getOwnerCustomers,
  getOwnerOrders,
  replyOwnerReview,
  updateAccountProfile,
  updateCustomerAddress,
  updateOwnerOrderStatus,
} from "@/services/orders"
import { getOwnerRestaurants } from "@/services/restaurants"

export function useCustomerAddresses(enabled = true) {
  const [addresses, setAddresses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const loadAddresses = useCallback(async () => {
    if (!enabled) {
      setAddresses([])
      setError("")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const data = await getCustomerAddresses()
      setAddresses(data)
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar las direcciones")
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    loadAddresses()
  }, [loadAddresses])

  return {
    addresses,
    isLoading,
    error,
    createAddress: async (payload) => {
      await createCustomerAddress(payload)
      await loadAddresses()
    },
    updateAddress: async (addressId, payload) => {
      await updateCustomerAddress(addressId, payload)
      await loadAddresses()
    },
    deleteAddress: async (addressId) => {
      await deleteCustomerAddress(addressId)
      await loadAddresses()
    },
  }
}

export function useCustomerOrders() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatingOrderId, setUpdatingOrderId] = useState("")

  const mergeOrder = useCallback((nextOrder) => {
    setOrders((current) => {
      const existing = current.some((order) => order.id === nextOrder.id)
      if (!existing) {
        return [nextOrder, ...current]
      }
      return current.map((order) => (order.id === nextOrder.id ? nextOrder : order))
    })
  }, [])

  useEffect(() => {
    getCustomerOrders()
      .then((data) => {
        setOrders(data)
        setError("")
      })
      .catch((loadError) => {
        setError(loadError.message || "No fue posible cargar los pedidos")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  return {
    orders,
    isLoading,
    error,
    updatingOrderId,
    mergeOrder,
    cancelOrder: async (orderId, reason) => {
      setUpdatingOrderId(orderId)
      try {
        const updatedOrder = await cancelCheckoutOrder(orderId, reason)
        mergeOrder(updatedOrder)
        return updatedOrder
      } finally {
        setUpdatingOrderId("")
      }
    },
  }
}

export function useOwnerOrders() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatingOrderId, setUpdatingOrderId] = useState("")

  const mergeOrder = useCallback((nextOrder) => {
    setOrders((current) => {
      const existing = current.some((order) => order.id === nextOrder.id)
      if (!existing) {
        return [nextOrder, ...current]
      }
      return current.map((order) => (order.id === nextOrder.id ? nextOrder : order))
    })
  }, [])

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getOwnerOrders()
      setOrders(data)
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar los pedidos")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  return {
    orders,
    isLoading,
    error,
    updatingOrderId,
    mergeOrder,
    reloadOrders: loadOrders,
    updateStatus: async (orderId, statusCode) => {
      setUpdatingOrderId(orderId)
      try {
        const updatedOrder = await updateOwnerOrderStatus(orderId, statusCode)
        mergeOrder(updatedOrder)
        return updatedOrder
      } finally {
        setUpdatingOrderId("")
      }
    },
    cancelOrder: async (orderId, reason) => {
      setUpdatingOrderId(orderId)
      try {
        const updatedOrder = await cancelOwnerOrder(orderId, reason)
        mergeOrder(updatedOrder)
        return updatedOrder
      } finally {
        setUpdatingOrderId("")
      }
    },
  }
}

export function useCheckout() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  return {
    isSubmitting,
    submitOrder: async (payload) => {
      setIsSubmitting(true)
      try {
        return await createCheckoutOrder(payload)
      } finally {
        setIsSubmitting(false)
      }
    },
  }
}

export function useGuestOrder(entry) {
  const [order, setOrder] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const mergeOrder = useCallback((nextOrder) => {
    setOrder((current) => {
      if (!current || current.id !== nextOrder.id) {
        return nextOrder
      }
      return nextOrder
    })
  }, [])

  useEffect(() => {
    const orderId = entry?.id
    const trackingCode = entry?.tracking_code

    if (!orderId && !trackingCode) {
      return
    }

    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) {
        return
      }
      setOrder(null)
      setError("")
      setIsLoading(true)
    })

    const request = trackingCode ? getGuestOrder(trackingCode) : getCheckoutOrderStatus(orderId)
    request
      .then((data) => {
        if (cancelled) {
          return
        }
        setOrder(data)
        setError("")
      })
      .catch((loadError) => {
        if (cancelled) {
          return
        }
        setError(loadError.message || "No fue posible cargar el pedido")
      })
      .finally(() => {
        if (cancelled) {
          return
        }
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [entry])

  if (!entry?.id && !entry?.tracking_code) {
    return { order: null, isLoading: false, error: "", mergeOrder }
  }

  return { order, isLoading, error, mergeOrder }
}

export function useGuestOrderCancellation() {
  const [isCancelling, setIsCancelling] = useState(false)

  return {
    isCancelling,
    cancelOrder: async (orderId, reason) => {
      setIsCancelling(true)
      try {
        return await cancelCheckoutOrder(orderId, reason)
      } finally {
        setIsCancelling(false)
      }
    },
  }
}

export function useCustomerDashboard() {
  const [data, setData] = useState({
    user_name: "",
    metrics: {
      total_orders: 0,
      points: 0,
      favorite_restaurants_count: 0,
      average_delivery_time: 0,
    },
    recent_orders: [],
    favorite_restaurants: [],
    loyalty: { points: 0, tier: "Base" },
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    getCustomerDashboard()
      .then((payload) => {
        setData(payload)
        setError("")
      })
      .catch((loadError) => {
        setError(loadError.message || "No fue posible cargar el dashboard")
      })
      .finally(() => setIsLoading(false))
  }, [])

  return { data, isLoading, error }
}

export function useOwnerCustomers() {
  const [data, setData] = useState({
    metrics: {
      total_customers: 0,
      new_customers_this_month: 0,
      average_ticket: 0,
      vip_customers: 0,
    },
    customers: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const restaurants = await getOwnerRestaurants()
        const restaurant = restaurants[0]
        if (!restaurant) {
          setData({
            metrics: {
              total_customers: 0,
              new_customers_this_month: 0,
              average_ticket: 0,
              vip_customers: 0,
            },
            customers: [],
          })
          return
        }
        const payload = await getOwnerCustomers(restaurant.id)
        setData(payload)
        setError("")
      } catch (loadError) {
        setError(loadError.message || "No fue posible cargar los clientes")
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  return { data, isLoading, error }
}

export function useOwnerAnalytics() {
  const [data, setData] = useState({
    sales: {},
    hourly_data: [],
    top_products: [],
    customer_metrics: {
      total_customers: 0,
      new_this_month: 0,
      returning: 0,
      average_ticket: 0,
    },
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const restaurants = await getOwnerRestaurants()
        const restaurant = restaurants[0]
        if (!restaurant) {
          return
        }
        const payload = await getOwnerAnalytics(restaurant.id)
        setData(payload)
        setError("")
      } catch (loadError) {
        setError(loadError.message || "No fue posible cargar las analiticas")
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  return { data, isLoading, error }
}

export function useOwnerReviews() {
  const [data, setData] = useState({
    metrics: {
      average_rating: "0.00",
      total_reviews: 0,
      this_month: 0,
      pending_replies: 0,
    },
    distribution: [],
    reviews: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isReplying, setIsReplying] = useState(false)
  const [error, setError] = useState("")

  const loadReviews = useCallback(async () => {
    setIsLoading(true)
    try {
      const restaurants = await getOwnerRestaurants()
      const restaurant = restaurants[0]
      if (!restaurant) {
        setData({
          metrics: {
            average_rating: "0.00",
            total_reviews: 0,
            this_month: 0,
            pending_replies: 0,
          },
          distribution: [],
          reviews: [],
        })
        return
      }
      const payload = await getOwnerReviews(restaurant.id)
      setData(payload)
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar las resenas")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  return {
    data,
    isLoading,
    isReplying,
    error,
    replyReview: async (reviewId, response) => {
      setIsReplying(true)
      try {
        const restaurants = await getOwnerRestaurants()
        const restaurant = restaurants[0]
        if (!restaurant) {
          throw new Error("No se encontro un restaurante asociado a esta cuenta")
        }
        await replyOwnerReview(restaurant.id, reviewId, response)
        await loadReviews()
      } finally {
        setIsReplying(false)
      }
    },
  }
}

export function useCustomerFavorites() {
  const [favorites, setFavorites] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const loadFavorites = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getCustomerFavorites()
      setFavorites(data)
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar los favoritos")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  return {
    favorites,
    isLoading,
    error,
    removeFavorite: async (favoriteId) => {
      await deleteCustomerFavorite(favoriteId)
      await loadFavorites()
    },
  }
}

export function useAccountProfile() {
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    getAccountProfile()
      .then((data) => {
        setProfile(data)
        setError("")
      })
      .catch((loadError) => {
        setError(loadError.message || "No fue posible cargar el perfil")
      })
      .finally(() => setIsLoading(false))
  }, [])

  return {
    profile,
    isLoading,
    isSaving,
    error,
    saveProfile: async (payload) => {
      setIsSaving(true)
      try {
        const updated = await updateAccountProfile(payload)
        setProfile(updated)
        return updated
      } finally {
        setIsSaving(false)
      }
    },
  }
}

export function useCustomerLoyalty() {
  const [data, setData] = useState({
    current_points: 0,
    total_earned: 0,
    current_level: "Base",
    rewards_redeemed: 0,
    available_rewards: [],
    history: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    getCustomerLoyalty()
      .then((payload) => {
        setData(payload)
        setError("")
      })
      .catch((loadError) => {
        setError(loadError.message || "No fue posible cargar tus puntos")
      })
      .finally(() => setIsLoading(false))
  }, [])

  return { data, isLoading, error }
}
