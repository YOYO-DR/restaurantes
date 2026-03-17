import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RestaurantMenu } from "@/components/restaurants/restaurant-menu"

vi.mock("@/context/cart-context", () => ({
  useCart: () => ({ addItem: vi.fn() }),
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
      },
      {
        id: "b",
        name: "Ajiaco",
        description: "Tradicional",
        price_amount: "28000.00",
        currency_code: "COP",
        is_available: true,
        is_popular: false,
      },
    ],
  },
]

describe("RestaurantMenu", () => {
  it("respects dropdown navigation and hidden fields", () => {
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
