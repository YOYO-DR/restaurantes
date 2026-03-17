import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { useAuth } from "@/context/auth-context"
import { toast } from "sonner"

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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe("Auth forms", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows validation errors in login form", async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue({ login: vi.fn() })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole("button", { name: "Iniciar sesion" }))

    expect(await screen.findByText("Ingresa un correo valido")).toBeInTheDocument()
    expect(screen.getByText("La contrasena debe tener minimo 8 caracteres")).toBeInTheDocument()
  })

  it("submits login and redirects by role", async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockResolvedValue({ role: "cliente" })
    useAuth.mockReturnValue({ login })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText("Correo electronico"), "cliente@foodhub.com")
    await user.type(screen.getByLabelText("Contrasena"), "password123")
    await user.click(screen.getByRole("button", { name: "Iniciar sesion" }))

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "cliente@foodhub.com",
        password: "password123",
      })
    })

    expect(toast.success).toHaveBeenCalledWith("Sesion iniciada con exito")
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/cliente", { replace: true })
  })

  it("uses previous protected path after login", async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockResolvedValue({ role: "cliente" })
    useAuth.mockReturnValue({ login })

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: { from: "/dashboard/cliente/pedidos?filtro=abiertos#listado" },
          },
        ]}
      >
        <LoginForm />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText("Correo electronico"), "cliente@foodhub.com")
    await user.type(screen.getByLabelText("Contrasena"), "password123")
    await user.click(screen.getByRole("button", { name: "Iniciar sesion" }))

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "cliente@foodhub.com",
        password: "password123",
      })
    })

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/cliente/pedidos?filtro=abiertos#listado", {
      replace: true,
    })
  })

  it("falls back to role dashboard when previous path is for another role", async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockResolvedValue({ role: "cliente" })
    useAuth.mockReturnValue({ login })

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: { from: "/dashboard/admin/usuarios" },
          },
        ]}
      >
        <LoginForm />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText("Correo electronico"), "cliente@foodhub.com")
    await user.type(screen.getByLabelText("Contrasena"), "password123")
    await user.click(screen.getByRole("button", { name: "Iniciar sesion" }))

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "cliente@foodhub.com",
        password: "password123",
      })
    })

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/cliente", {
      replace: true,
    })
  })

  it("shows server error feedback in login form", async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockRejectedValue(new Error("Credenciales invalidas"))
    useAuth.mockReturnValue({ login })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText("Correo electronico"), "cliente@foodhub.com")
    await user.type(screen.getByLabelText("Contrasena"), "password123")
    await user.click(screen.getByRole("button", { name: "Iniciar sesion" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales invalidas")
    expect(toast.error).toHaveBeenCalledWith("Credenciales invalidas")
  })

  it("submits register payload and redirects", async () => {
    const user = userEvent.setup()
    const register = vi.fn().mockResolvedValue({ role: "dueno" })
    useAuth.mockReturnValue({ register })

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>,
    )

    await user.click(screen.getByText("Dueno"))
    await user.type(screen.getByLabelText("Nombre"), "Ana")
    await user.type(screen.getByLabelText("Apellido"), "Lopez")
    await user.type(screen.getByLabelText("Correo electronico"), "ana@foodhub.com")
    await user.type(screen.getByLabelText("Telefono"), "+57 300 000 0000")
    await user.type(screen.getByLabelText("Nombre del restaurante"), "Casa Ana")
    await user.type(screen.getByLabelText("Direccion del restaurante"), "Calle 10 #20-30")
    await user.type(screen.getByLabelText("Contrasena"), "password123")
    await user.type(screen.getByLabelText("Confirmar contrasena"), "password123")

    const terms = screen.getByRole("checkbox", {
      name: /acepto los terminos de servicio y la politica de privacidad/i,
    })
    await user.click(terms)
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }))

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        email: "ana@foodhub.com",
        name: "Ana Lopez",
        phone: "+57 300 000 0000",
        password: "password123",
        password_confirm: "password123",
        user_type: "dueno",
        restaurant_name: "Casa Ana",
        restaurant_address: "Calle 10 #20-30",
      })
    })

    expect(toast.success).toHaveBeenCalledWith("Cuenta creada con exito")
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/restaurante", { replace: true })
  })

  it("shows a clear error when terms are unchecked", async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue({ register: vi.fn() })

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>,
    )

    const terms = screen.getByRole("checkbox", {
      name: /acepto los terminos de servicio y la politica de privacidad/i,
    })

    await user.click(terms)
    await user.click(terms)

    expect(await screen.findByText("Debes aceptar terminos y politica de privacidad")).toBeInTheDocument()
  })
})
