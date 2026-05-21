import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const mockUsePlanFeature = vi.fn()
vi.mock("@/hooks/use-plan-feature", () => ({
  usePlanFeature: (...args) => mockUsePlanFeature(...args),
}))

const { FeatureGate } = await import("@/components/auth/feature-gate")

describe("FeatureGate", () => {
  it("renders children when feature is enabled", () => {
    mockUsePlanFeature.mockReturnValue({ canView: true, canCreate: true, canEdit: true, canDelete: true, isLocked: false })
    render(<FeatureGate feature="menu"><span>Content</span></FeatureGate>)
    expect(screen.getByText("Content")).toBeInTheDocument()
  })

  it("hides children when feature is disabled", () => {
    mockUsePlanFeature.mockReturnValue({ canView: false, canCreate: false, canEdit: false, canDelete: false, isLocked: true })
    render(<FeatureGate feature="lealtad"><span>Hidden</span></FeatureGate>)
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument()
  })

  it("renders fallback when feature is disabled", () => {
    mockUsePlanFeature.mockReturnValue({ canView: false, canCreate: false, canEdit: false, canDelete: false, isLocked: true })
    render(
      <FeatureGate feature="lealtad" fallback={<span>Upgrade</span>}>
        <span>Hidden</span>
      </FeatureGate>
    )
    expect(screen.getByText("Upgrade")).toBeInTheDocument()
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument()
  })

  it("respects action=create", () => {
    mockUsePlanFeature.mockReturnValue({ canView: true, canCreate: false, canEdit: false, canDelete: false, isLocked: false })
    render(<FeatureGate feature="menu" action="create"><span>Create Button</span></FeatureGate>)
    expect(screen.queryByText("Create Button")).not.toBeInTheDocument()
  })

  it("respects action=edit", () => {
    mockUsePlanFeature.mockReturnValue({ canView: true, canCreate: false, canEdit: true, canDelete: false, isLocked: false })
    render(<FeatureGate feature="menu" action="edit"><span>Edit Button</span></FeatureGate>)
    expect(screen.getByText("Edit Button")).toBeInTheDocument()
  })
})
