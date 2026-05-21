import { describe, expect, it, vi } from "vitest"

// Mock auth context
const mockUseAuth = vi.fn()
vi.mock("@/context/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}))

const { usePlanFeature } = await import("@/hooks/use-plan-feature")

function makeUser(features = {}, status = "active", plan = "pro") {
  return {
    subscription: {
      plan,
      plan_name: "Pro",
      status,
      trial_end: null,
      features,
    },
  }
}

describe("usePlanFeature", () => {
  it("returns full access for admin role", () => {
    mockUseAuth.mockReturnValue({ user: { roles: ["admin"], role: "admin" }, activeRole: "admin" })
    const result = usePlanFeature("menu")
    expect(result.canView).toBe(true)
    expect(result.canCreate).toBe(true)
    expect(result.isLocked).toBe(false)
    expect(result.planCode).toBeNull()
  })

  it("returns no access when no subscription", () => {
    mockUseAuth.mockReturnValue({ user: {}, activeRole: "restaurante" })
    const result = usePlanFeature("menu")
    expect(result.canView).toBe(false)
    expect(result.isLocked).toBe(true)
  })

  it("returns plan feature permissions for owner", () => {
    const user = makeUser({ menu: { can_view: true, can_create: true, can_edit: false, can_delete: false } })
    mockUseAuth.mockReturnValue({ user, activeRole: "restaurante" })
    const result = usePlanFeature("menu")
    expect(result.canView).toBe(true)
    expect(result.canCreate).toBe(true)
    expect(result.canEdit).toBe(false)
    expect(result.canDelete).toBe(false)
    expect(result.isLocked).toBe(false)
  })

  it("sets isLocked true when canView is false", () => {
    const user = makeUser({ lealtad: { can_view: false, can_create: false, can_edit: false, can_delete: false } })
    mockUseAuth.mockReturnValue({ user, activeRole: "restaurante" })
    const result = usePlanFeature("lealtad")
    expect(result.isLocked).toBe(true)
  })

  it("returns no access for missing module even with subscription", () => {
    const user = makeUser({ menu: { can_view: true, can_create: false, can_edit: false, can_delete: false } })
    mockUseAuth.mockReturnValue({ user, activeRole: "restaurante" })
    const result = usePlanFeature("lealtad")
    expect(result.canView).toBe(false)
    expect(result.isLocked).toBe(true)
  })

  it("exposes planCode from subscription", () => {
    const user = makeUser({ menu: { can_view: true, can_create: false, can_edit: false, can_delete: false } }, "active", "free")
    mockUseAuth.mockReturnValue({ user, activeRole: "restaurante" })
    const result = usePlanFeature("menu")
    expect(result.planCode).toBe("free")
  })
})
