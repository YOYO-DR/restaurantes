import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// Minimal Tooltip mocks to avoid Radix Portal issues in jsdom
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }) => children,
  Tooltip: ({ children }) => children,
  TooltipTrigger: ({ children }) => children,
  TooltipContent: ({ children }) => <div role="tooltip">{children}</div>,
}))

const { LockedAction } = await import("@/components/ui/locked-action")

describe("LockedAction", () => {
  it("renders children when not locked", () => {
    render(<LockedAction locked={false}><button>Create</button></LockedAction>)
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument()
  })

  it("renders lock icon when locked", () => {
    render(<LockedAction locked={true} planName="Pro">Create</LockedAction>)
    expect(document.querySelector('[aria-disabled="true"]')).toBeInTheDocument()
  })

  it("shows tooltip with plan name when locked", () => {
    render(<LockedAction locked={true} planName="Pro">Create</LockedAction>)
    expect(screen.getByText("Mejora a Pro para desbloquear")).toBeInTheDocument()
  })

  it("shows generic tooltip when no plan name", () => {
    render(<LockedAction locked={true}>Create</LockedAction>)
    expect(screen.getByText("Funcionalidad no disponible en tu plan")).toBeInTheDocument()
  })

  it("has aria-disabled=true when locked", () => {
    render(<LockedAction locked={true} planName="Pro">Btn</LockedAction>)
    const el = document.querySelector('[aria-disabled="true"]')
    expect(el).not.toBeNull()
  })
})
