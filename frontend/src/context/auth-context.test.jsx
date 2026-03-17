import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AuthProvider, useAuth } from "@/context/auth-context"
import {
  apiJson,
  clearAccessToken,
  onAuthFailure,
  refreshAccessToken,
  setAccessToken,
} from "@/lib/api"
import { toast } from "sonner"

vi.mock("@/lib/api", () => ({
  apiJson: vi.fn(),
  clearAccessToken: vi.fn(),
  onAuthFailure: vi.fn(),
  refreshAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

function AuthProbe() {
  const { user, isLoading, isAuthenticated, login } = useAuth()

  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="email">{user?.email || ""}</div>
      <button
        type="button"
        onClick={() => {
          login({ email: "demo@test.com", password: "password123" })
        }}
      >
        Login
      </button>
    </div>
  )
}

describe("AuthProvider", () => {
  let authFailureHandler = null

  beforeEach(() => {
    vi.clearAllMocks()
    authFailureHandler = null

    onAuthFailure.mockImplementation((handler) => {
      authFailureHandler = handler
      return () => {
        authFailureHandler = null
      }
    })
  })

  it("loads session from refresh and me endpoint", async () => {
    refreshAccessToken.mockResolvedValue(true)
    apiJson.mockResolvedValue({ email: "user@test.com", role: "cliente" })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    })

    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(apiJson).toHaveBeenCalledWith("/api/auth/me/")
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true")
    expect(screen.getByTestId("email")).toHaveTextContent("user@test.com")
  })

  it("updates state after login", async () => {
    const user = userEvent.setup()
    refreshAccessToken.mockResolvedValue(false)
    apiJson.mockImplementation((path) => {
      if (path === "/api/auth/login/") {
        return Promise.resolve({
          access: "access-token",
          user: { email: "demo@test.com", role: "cliente" },
        })
      }
      return Promise.reject(new Error("Unexpected path"))
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    })

    await user.click(screen.getByRole("button", { name: "Login" }))

    await waitFor(() => {
      expect(setAccessToken).toHaveBeenCalledWith("access-token")
    })

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true")
    expect(screen.getByTestId("email")).toHaveTextContent("demo@test.com")
  })

  it("logs out globally when refresh failure is emitted", async () => {
    const user = userEvent.setup()
    refreshAccessToken.mockResolvedValue(false)
    apiJson.mockImplementation((path) => {
      if (path === "/api/auth/login/") {
        return Promise.resolve({
          access: "access-token",
          user: { email: "demo@test.com", role: "cliente" },
        })
      }
      return Promise.reject(new Error("Unexpected path"))
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    })

    await user.click(screen.getByRole("button", { name: "Login" }))

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true")
    })

    authFailureHandler()

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false")
    })

    expect(clearAccessToken).toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith("Tu sesion expiro. Inicia sesion de nuevo.")
  })
})
