import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RestaurantMenu } from "@/components/restaurants/restaurant-menu"

const authState = {
  isAuthenticated: false,
}

const loyaltyState = {
  data: { current_points: 0 },
  isLoading: false,
}

vi.mock("@/context/cart-context", () => ({
  useCart: () => ({ addItem: vi.fn() }),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => authState,
}))

vi.mock("@/hooks/use-orders", () => ({
  useCustomerLoyalty: () => loyaltyState,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}))

const categories = [
  {
    id: "1",
    slug: "entradas",
    name: "Entradas",
    items: [
      {
        id: "a",
        name: "Empanadas",
        description: "Crujientes",
        price_amount: "12000.00",
        currency_code: "COP",
        is_available: true,
        is_popular: true,
        earns_points: true,
        allows_points_redemption: true,
        min_points_redeemable: 50,
        max_points_redeemable: 120,
      },
      {
        id: "b",
        name: "Ajiaco",
        description: "Tradicional",
        price_amount: "28000.00",
        currency_code: "COP",
        is_available: true,
        is_popular: false,
        earns_points: false,
        allows_points_redemption: false,
      },
    ],
  },
]

describe("RestaurantMenu", () => {
  it("shows loyalty message only for eligible products", () => {
    authState.isAuthenticated = false
    loyaltyState.data = { current_points: 0 }

    render(
      <RestaurantMenu
        categories={categories}
        restaurant={{
          id: "r1",
          slug: "demo",
          name: "Demo",
          delivery_fee_amount: "0.00",
          has_table_order: false,
          category_navigation: "tabs",
          search_enabled: true,
          filters_enabled: true,
          show_prices: true,
          show_descriptions: true,
          show_tags: true,
          menu_layout: "cards",
          image_size: "medium",
        }}
        isLoading={false}
        error=""
      />,
    )

    expect(screen.getByText("Gana puntos")).toBeInTheDocument()
    expect(screen.queryByText(/Ajiaco.*puntos/i)).not.toBeInTheDocument()
  })

  it("shows minimum points message for authenticated customers", () => {
    authState.isAuthenticated = true
    loyaltyState.data = { current_points: 20, is_active: true }

    render(
      <RestaurantMenu
        categories={categories}
        restaurant={{
          id: "r1",
          slug: "demo",
          name: "Demo",
          delivery_fee_amount: "0.00",
          has_table_order: false,
          category_navigation: "tabs",
          search_enabled: true,
          filters_enabled: true,
          show_prices: true,
          show_descriptions: true,
          show_tags: true,
          menu_layout: "cards",
          image_size: "medium",
        }}
        isLoading={false}
        error=""
      />,
    )

    expect(screen.getByText("Acepta canje")).toBeInTheDocument()
    expect(screen.getByText("No otorga puntos")).toBeInTheDocument()
  })

  it("respects dropdown navigation and hidden fields", () => {
    authState.isAuthenticated = false
    loyaltyState.data = { current_points: 0 }

    render(
      <RestaurantMenu
        categories={categories}
        restaurant={{
          id: "r1",
          slug: "demo",
          name: "Demo",
          delivery_fee_amount: "0.00",
          has_table_order: false,
          category_navigation: "dropdown",
          search_enabled: false,
          show_prices: false,
          show_descriptions: false,
          show_tags: false,
          menu_layout: "cards",
          image_size: "medium",
        }}
        isLoading={false}
        error=""
      />,
    )

    expect(screen.queryByPlaceholderText("Buscar productos...")).not.toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(screen.queryByText("Crujientes")).not.toBeInTheDocument()
    expect(screen.queryByText("Popular")).not.toBeInTheDocument()
    expect(screen.queryByText("$ 12.000,00")).not.toBeInTheDocument()
  })

  it("filters popular items when enabled", async () => {
    authState.isAuthenticated = false
    loyaltyState.data = { current_points: 0 }
    const user = userEvent.setup()

    render(
      <RestaurantMenu
        categories={categories}
        restaurant={{
          id: "r1",
          slug: "demo",
          name: "Demo",
          delivery_fee_amount: "0.00",
          has_table_order: false,
          category_navigation: "tabs",
          search_enabled: true,
          filters_enabled: true,
          show_prices: true,
          show_descriptions: true,
          show_tags: true,
          menu_layout: "cards",
          image_size: "medium",
        }}
        isLoading={false}
        error=""
      />,
    )

    await user.click(screen.getByRole("button", { name: "Populares" }))

    expect(screen.getByText("Empanadas")).toBeInTheDocument()
    expect(screen.queryByText("Ajiaco")).not.toBeInTheDocument()
  })

  it("shows empty state when filters remove all items", async () => {
    authState.isAuthenticated = false
    loyaltyState.data = { current_points: 0 }
    const user = userEvent.setup()

    render(
      <RestaurantMenu
        categories={categories}
        restaurant={{
          id: "r1",
          slug: "demo",
          name: "Demo",
          delivery_fee_amount: "0.00",
          has_table_order: false,
          category_navigation: "tabs",
          search_enabled: true,
          filters_enabled: true,
          show_prices: true,
          show_descriptions: true,
          show_tags: true,
          menu_layout: "grid",
          image_size: "medium",
        }}
        isLoading={false}
        error=""
      />,
    )

    await user.type(screen.getByPlaceholderText("Buscar productos..."), "pizza")

    expect(screen.getByText("No hay productos que coincidan con los filtros actuales.")).toBeInTheDocument()
  })
})
