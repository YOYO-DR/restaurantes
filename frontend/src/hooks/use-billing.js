import { useCallback, useEffect, useState } from "react"
import { apiJson } from "@/lib/api"

export function useBilling() {
  const [plans, setPlans] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [changeRequests, setChangeRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [plansData, subData, reqsData] = await Promise.all([
        apiJson("/api/owner/billing/plans/"),
        apiJson("/api/owner/billing/subscription/").catch(() => null),
        apiJson("/api/owner/billing/plan-change-requests/").catch(() => []),
      ])
      setPlans(plansData || [])
      setSubscription(subData)
      setChangeRequests(reqsData || [])
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const requestPlanChange = useCallback(async (planId, notes = "") => {
    const req = await apiJson("/api/owner/billing/plan-change-requests/", {
      method: "POST",
      body: JSON.stringify({ requested_plan: planId, notes }),
    })
    setChangeRequests((prev) => [req, ...prev])
    return req
  }, [])

  const cancelSubscription = useCallback(async () => {
    const updated = await apiJson("/api/owner/billing/subscription/cancel/", { method: "POST" })
    setSubscription(updated)
    return updated
  }, [])

  return {
    plans,
    subscription,
    changeRequests,
    loading,
    error,
    refetch: fetchAll,
    requestPlanChange,
    cancelSubscription,
  }
}
