import { useEffect, useState } from "react"

import {
  getAdminDashboard,
  getAdminRestaurant,
  getAdminReports,
  getAdminRestaurants,
  getAdminSettings,
  getAdminUsers,
  updateAdminRestaurant,
  updateAdminSettings,
} from "@/services/admin"

function createAsyncState(initialData) {
  return {
    data: initialData,
    isLoading: true,
    error: "",
  }
}

export function useAdminDashboard(orderScope = "all") {
  const [state, setState] = useState(createAsyncState(null))

  useEffect(() => {
    let isMounted = true

    getAdminDashboard(orderScope)
      .then((data) => {
        if (!isMounted) {
          return
        }
        setState({ data, isLoading: false, error: "" })
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }
        setState({
          data: null,
          isLoading: false,
          error: error.message || "No fue posible cargar el dashboard administrativo",
        })
      })

    return () => {
      isMounted = false
    }
  }, [orderScope])

  return state
}

export function useAdminUsers(filters) {
  const [state, setState] = useState(createAsyncState({ counts: {}, results: [] }))

  useEffect(() => {
    let isMounted = true

    setState((current) => ({ ...current, isLoading: true, error: "" }))
    getAdminUsers(filters)
      .then((data) => {
        if (!isMounted) {
          return
        }
        setState({ data, isLoading: false, error: "" })
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }
        setState({
          data: { counts: {}, results: [] },
          isLoading: false,
          error: error.message || "No fue posible cargar los usuarios",
        })
      })

    return () => {
      isMounted = false
    }
  }, [
    filters.email,
    filters.joinedAt,
    filters.name,
    filters.ordering,
    filters.ordersCount,
    filters.page,
    filters.pageSize,
    filters.phone,
    filters.role,
    filters.status,
  ])

  return state
}

export function useAdminRestaurants(filters) {
  const [state, setState] = useState(createAsyncState({ counts: {}, results: [] }))

  useEffect(() => {
    let isMounted = true

    setState((current) => ({ ...current, isLoading: true, error: "" }))
    getAdminRestaurants(filters)
      .then((data) => {
        if (!isMounted) {
          return
        }
        setState({ data, isLoading: false, error: "" })
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }
        setState({
          data: { counts: {}, results: [] },
          isLoading: false,
          error: error.message || "No fue posible cargar los restaurantes",
        })
      })

    return () => {
      isMounted = false
    }
  }, [
    filters.category,
    filters.joinedAt,
    filters.name,
    filters.ordering,
    filters.ordersCount,
    filters.owner,
    filters.page,
    filters.pageSize,
    filters.revenue,
    filters.status,
    filters.subscriptionPlan,
  ])

  return state
}

export function useAdminRestaurantEditor() {
  const [isSaving, setIsSaving] = useState(false)

  return {
    isSaving,
    loadRestaurant: (restaurantId) => getAdminRestaurant(restaurantId),
    saveRestaurant: async (restaurantId, payload) => {
      setIsSaving(true)
      try {
        return await updateAdminRestaurant(restaurantId, payload)
      } finally {
        setIsSaving(false)
      }
    },
  }
}

export function useAdminReports() {
  const [state, setState] = useState(
    createAsyncState({ daily_trends: [], category_performance: [], order_type_distribution: [], insights: [] }),
  )

  useEffect(() => {
    let isMounted = true

    getAdminReports()
      .then((data) => {
        if (!isMounted) {
          return
        }
        setState({ data, isLoading: false, error: "" })
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }
        setState({
          data: { daily_trends: [], category_performance: [], order_type_distribution: [], insights: [] },
          isLoading: false,
          error: error.message || "No fue posible cargar los reportes",
        })
      })

    return () => {
      isMounted = false
    }
  }, [])

  return state
}

export function useAdminSettings() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    getAdminSettings()
      .then((response) => {
        if (!isMounted) {
          return
        }
        setData(response)
        setError("")
      })
      .catch((loadError) => {
        if (!isMounted) {
          return
        }
        setError(loadError.message || "No fue posible cargar la configuracion")
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return {
    data,
    isLoading,
    isSaving,
    error,
    saveSettings: async (payload) => {
      setIsSaving(true)
      try {
        const updated = await updateAdminSettings(payload)
        setData((current) => ({ ...current, ...updated }))
        setError("")
        return updated
      } catch (saveError) {
        setError(saveError.message || "No fue posible guardar la configuracion")
        throw saveError
      } finally {
        setIsSaving(false)
      }
    },
  }
}
