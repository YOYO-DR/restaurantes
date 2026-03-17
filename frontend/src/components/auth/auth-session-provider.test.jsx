import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { AuthSessionProvider } from "@/components/auth/auth-session-provider"
import { useAuth } from "@/context/auth-context"

const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/context/auth-context", () => ({
  useAuth: vi.fn(),
}))

describe("AuthSessionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects to login when session expires on protected route", async () => {
    useAuth.mockReturnValue({
      sessionExpiredAt: Date.now(),
    })

    render(
      <MemoryRouter initialEntries={["/dashboard/cliente"]}>
        <AuthSessionProvider>
          <div>Protected content</div>
        </AuthSessionProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        replace: true,
        state: { from: "/dashboard/cliente" },
      })
    })
  })

  it("preserves search and hash in redirect state", async () => {
    useAuth.mockReturnValue({
      sessionExpiredAt: Date.now(),
    })

    render(
      <MemoryRouter initialEntries={["/dashboard/restaurante/pedidos?estado=pendiente#tabla"]}>
        <AuthSessionProvider>
          <div>Protected content</div>
        </AuthSessionProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        replace: true,
        state: { from: "/dashboard/restaurante/pedidos?estado=pendiente#tabla" },
      })
    })
  })

  it("does not redirect when current route is public", async () => {
    useAuth.mockReturnValue({
      sessionExpiredAt: Date.now(),
    })

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthSessionProvider>
          <div>Public content</div>
        </AuthSessionProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(useAuth).toHaveBeenCalled()
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
