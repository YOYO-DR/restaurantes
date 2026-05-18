import { useCallback, useEffect, useState } from "react"

import {
  createOwnerLoyaltyReward,
  createOwnerLoyaltyTier,
  deleteOwnerLoyaltyReward,
  deleteOwnerLoyaltyTier,
  getCustomerRedemptions,
  getOwnerLoyaltyRedemptions,
  getOwnerLoyaltyRewards,
  getOwnerLoyaltySetting,
  getOwnerLoyaltyTiers,
  redeemReward,
  updateOwnerLoyaltyReward,
  updateOwnerLoyaltySetting,
  updateOwnerLoyaltyTier,
} from "@/services/loyalty"

export function useOwnerLoyaltySetting(restaurantId) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!restaurantId) {
      setIsLoading(false)
      setData(null)
      return
    }
    setIsLoading(true)
    try {
      const payload = await getOwnerLoyaltySetting(restaurantId)
      setData(payload)
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar la configuracion de lealtad")
    } finally {
      setIsLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    load()
  }, [load])

  return {
    data,
    isLoading,
    error,
    save: async (payload) => {
      const updated = await updateOwnerLoyaltySetting(restaurantId, payload)
      setData(updated)
      return updated
    },
    reload: load,
  }
}

export function useOwnerLoyaltyTiers(restaurantId) {
  const [tiers, setTiers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!restaurantId) {
      setIsLoading(false)
      setTiers([])
      return
    }
    setIsLoading(true)
    try {
      setTiers(await getOwnerLoyaltyTiers(restaurantId))
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar los niveles")
    } finally {
      setIsLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    load()
  }, [load])

  return {
    tiers,
    isLoading,
    error,
    reload: load,
    create: async (payload) => {
      await createOwnerLoyaltyTier(payload)
      await load()
    },
    update: async (tierId, payload) => {
      await updateOwnerLoyaltyTier(tierId, payload)
      await load()
    },
    remove: async (tierId) => {
      await deleteOwnerLoyaltyTier(tierId)
      await load()
    },
  }
}

export function useOwnerLoyaltyRewards(restaurantId) {
  const [rewards, setRewards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!restaurantId) {
      setIsLoading(false)
      setRewards([])
      return
    }
    setIsLoading(true)
    try {
      setRewards(await getOwnerLoyaltyRewards(restaurantId))
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar las recompensas")
    } finally {
      setIsLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    load()
  }, [load])

  return {
    rewards,
    isLoading,
    error,
    reload: load,
    create: async (payload) => {
      await createOwnerLoyaltyReward(payload)
      await load()
    },
    update: async (rewardId, payload) => {
      await updateOwnerLoyaltyReward(rewardId, payload)
      await load()
    },
    remove: async (rewardId) => {
      await deleteOwnerLoyaltyReward(rewardId)
      await load()
    },
  }
}

export function useOwnerLoyaltyRedemptions(restaurantId) {
  const [redemptions, setRedemptions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!restaurantId) {
      setIsLoading(false)
      setRedemptions([])
      return
    }
    setIsLoading(true)
    try {
      setRedemptions(await getOwnerLoyaltyRedemptions(restaurantId))
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar los canjes")
    } finally {
      setIsLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    load()
  }, [load])

  return { redemptions, isLoading, error, reload: load }
}

export function useRedeemReward() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  return {
    isSubmitting,
    redeem: async (payload) => {
      setIsSubmitting(true)
      try {
        return await redeemReward(payload)
      } finally {
        setIsSubmitting(false)
      }
    },
  }
}

export function useCustomerRedemptions(status = "pending", enabled = true) {
  const [redemptions, setRedemptions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!enabled) {
      setRedemptions([])
      setIsLoading(false)
      setError("")
      return
    }
    setIsLoading(true)
    try {
      setRedemptions(await getCustomerRedemptions(status))
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar tus canjes")
    } finally {
      setIsLoading(false)
    }
  }, [enabled, status])

  useEffect(() => {
    load()
  }, [load])

  return { redemptions, isLoading, error, reload: load }
}
