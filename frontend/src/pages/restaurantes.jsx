import { useMemo, useState } from "react"
import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { RestaurantFilters } from "@/components/restaurants/restaurant-filters"
import { RestaurantGrid } from "@/components/restaurants/restaurant-grid"
import { useRestaurantList } from "@/hooks/use-restaurants"
export const metadata = {
    title: "Restaurantes - FoodHub",
    description: "Descubre los mejores restaurantes cerca de ti. Delivery y pickup disponible."
};
export default function RestaurantesPage() {
  const { data: restaurants, isLoading, error } = useRestaurantList()
  const [activeCategory, setActiveCategory] = useState("Todos")
  const [search, setSearch] = useState("")

  const categories = useMemo(() => {
    const values = Array.from(new Set(restaurants.map((restaurant) => restaurant.category).filter(Boolean)))
    return ["Todos", ...values]
  }, [restaurants])

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((restaurant) => {
      const matchesCategory = activeCategory === "Todos" || restaurant.category === activeCategory
      const term = search.trim().toLowerCase()
      const matchesSearch = !term || restaurant.name.toLowerCase().includes(term) || restaurant.category.toLowerCase().includes(term)
      return matchesCategory && matchesSearch
    })
  }, [activeCategory, restaurants, search])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/30 py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Restaurantes</h1>
            <p className="mt-2 text-muted-foreground">Encuentra tu restaurante favorito y haz tu pedido</p>
          </div>
        </section>

        <section className="py-8">
          <div className="container mx-auto px-4">
            <RestaurantFilters
              categories={categories}
              activeCategory={activeCategory}
              search={search}
              onCategoryChange={setActiveCategory}
              onSearchChange={setSearch}
            />
            <RestaurantGrid restaurants={filteredRestaurants} isLoading={isLoading} error={error} />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
