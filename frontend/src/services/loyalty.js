import { apiJson } from "@/lib/api"

export function getOwnerLoyaltySetting(restaurantId) {
  return apiJson(`/api/owner/restaurant-loyalty-settings/${restaurantId}/`)
}

export function updateOwnerLoyaltySetting(restaurantId, payload) {
  return apiJson(`/api/owner/restaurant-loyalty-settings/${restaurantId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function getOwnerLoyaltyTiers(restaurantId) {
  const params = new URLSearchParams({ restaurant: restaurantId })
  return apiJson(`/api/owner/loyalty-tiers/?${params.toString()}`)
}

export function createOwnerLoyaltyTier(payload) {
  return apiJson("/api/owner/loyalty-tiers/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateOwnerLoyaltyTier(tierId, payload) {
  return apiJson(`/api/owner/loyalty-tiers/${tierId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function deleteOwnerLoyaltyTier(tierId) {
  return apiJson(`/api/owner/loyalty-tiers/${tierId}/`, {
    method: "DELETE",
    headers: {},
  })
}

export function getOwnerLoyaltyRewards(restaurantId) {
  const params = new URLSearchParams({ restaurant: restaurantId })
  return apiJson(`/api/owner/loyalty-rewards/?${params.toString()}`)
}

export function createOwnerLoyaltyReward(payload) {
  return apiJson("/api/owner/loyalty-rewards/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateOwnerLoyaltyReward(rewardId, payload) {
  return apiJson(`/api/owner/loyalty-rewards/${rewardId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function deleteOwnerLoyaltyReward(rewardId) {
  return apiJson(`/api/owner/loyalty-rewards/${rewardId}/`, {
    method: "DELETE",
    headers: {},
  })
}

export function getOwnerLoyaltyRedemptions(restaurantId) {
  const params = new URLSearchParams({ restaurant: restaurantId })
  return apiJson(`/api/owner/loyalty-redemptions/?${params.toString()}`)
}

export function redeemReward(payload) {
  return apiJson("/api/customer/loyalty/redeem/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getCustomerRedemptions(status) {
  const params = new URLSearchParams()
  if (status) {
    params.set("status", status)
  }
  return apiJson(`/api/customer/loyalty/redemptions/${params.toString() ? `?${params.toString()}` : ""}`)
}
