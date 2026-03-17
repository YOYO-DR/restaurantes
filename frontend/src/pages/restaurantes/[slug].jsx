import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { CartSidebar } from "@/components/restaurants/cart-sidebar"
import { RestaurantHeader } from "@/components/restaurants/restaurant-header"
import { RestaurantMenu } from "@/components/restaurants/restaurant-menu"
import { useCart } from "@/context/cart-context"
import { useTheme } from "@/context/theme-context"
import { useRestaurantDetail, useRestaurantMenu } from "@/hooks/use-restaurants"
import { ShoppingBag, X } from "lucide-react"
export const metadata = {
    title: "El Buen Sabor - FoodHub",
    description: "Explora el menu y haz tu pedido"
};
export default function RestaurantPage() {
  const { slug = "el-buen-sabor" } = useParams()
  const restaurantState = useRestaurantDetail(slug)
  const menuState = useRestaurantMenu(slug)
  const { items, restaurant, clearCart } = useCart()
  const { theme, setTheme } = useTheme()
  const previousThemeRef = useRef(null)
  const [isFloatingCartOpen, setIsFloatingCartOpen] = useState(false)

  const publicRestaurant = restaurantState.data

  const showThemeToggle = publicRestaurant?.dark_mode_enabled !== false

  useEffect(() => {
    if (!publicRestaurant || showThemeToggle) {
      return
    }

    if (previousThemeRef.current === null) {
      previousThemeRef.current = theme
    }

    if (theme !== "light") {
      setTheme("light")
    }
  }, [publicRestaurant, setTheme, showThemeToggle, theme])

  useEffect(() => {
    if (!showThemeToggle || previousThemeRef.current === null) {
      return
    }

    setTheme(previousThemeRef.current)
    previousThemeRef.current = null
  }, [setTheme, showThemeToggle])

  useEffect(
    () => () => {
      if (previousThemeRef.current !== null) {
        setTheme(previousThemeRef.current)
        previousThemeRef.current = null
      }
    },
    [setTheme],
  )

  useEffect(() => {
    if (items.length === 0) {
      setIsFloatingCartOpen(false)
    }
  }, [items.length])

  if (restaurant && restaurant.id !== publicRestaurant?.id && publicRestaurant) {
    clearCart()
  }

  return (
    <div
      className={`flex min-h-screen flex-col ${publicRestaurant?.menu_layout === "grid" ? "bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(255,247,237,0.85)_38%,_transparent_70%)]" : publicRestaurant?.menu_layout === "list" ? "bg-[linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(255,255,255,1))]" : "bg-[linear-gradient(180deg,_rgba(255,251,235,0.7),_rgba(255,255,255,1))]"}`}
      style={{
        "--restaurant-primary": publicRestaurant?.primary_color || "#e85d04",
        "--restaurant-secondary": publicRestaurant?.secondary_color || "#16a34a",
      }}
    >
      <Header showThemeToggle={showThemeToggle} />
      <main className="flex-1">
        <RestaurantHeader restaurant={publicRestaurant} isLoading={restaurantState.isLoading} />
        <div className="container mx-auto px-4 py-8">
          <div className={publicRestaurant?.cart_position === "sidebar" ? "grid gap-8 lg:grid-cols-3" : "space-y-8"}>
            <div className={publicRestaurant?.cart_position === "sidebar" ? "lg:col-span-2" : ""}>
              <RestaurantMenu
                categories={menuState.data}
                restaurant={publicRestaurant}
                isLoading={menuState.isLoading}
                error={menuState.error}
              />
            </div>
            {publicRestaurant?.cart_position === "sidebar" ? (
              <div className="lg:col-span-1">
                <CartSidebar restaurant={publicRestaurant} />
              </div>
            ) : null}
            {publicRestaurant?.cart_position === "bottom" ? <CartSidebar restaurant={publicRestaurant} compact /> : null}
          </div>
        </div>
        {publicRestaurant?.cart_position === "floating" ? (
          <>
            <div className="fixed bottom-4 right-4 z-50 hidden w-[calc(100%-2rem)] max-w-sm md:block">
              <CartSidebar restaurant={publicRestaurant} compact />
            </div>

            {items.length > 0 ? (
              <>
                <div className="fixed right-4 bottom-4 z-50 md:hidden">
                  <Button
                    type="button"
                    size="lg"
                    className="h-14 rounded-full px-5 shadow-xl"
                    onClick={() => setIsFloatingCartOpen((current) => !current)}
                  >
                    {isFloatingCartOpen ? <X className="mr-2 h-5 w-5" /> : <ShoppingBag className="mr-2 h-5 w-5" />}
                    {isFloatingCartOpen ? "Cerrar carrito" : `Ver pedido${items.length > 0 ? ` (${items.length})` : ""}`}
                  </Button>
                </div>

                <Drawer open={isFloatingCartOpen} onOpenChange={setIsFloatingCartOpen}>
                  <DrawerContent className="max-h-[85vh] px-0">
                    <DrawerHeader className="px-4 pb-2 text-left">
                      <DrawerTitle>Tu pedido</DrawerTitle>
                      <DrawerDescription>Revisa tu carrito o cierralo para seguir explorando el menu.</DrawerDescription>
                    </DrawerHeader>
                    <div className="overflow-y-auto px-4 pb-6">
                      <CartSidebar restaurant={publicRestaurant} compact inline />
                    </div>
                  </DrawerContent>
                </Drawer>
              </>
            ) : null}
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  )
}
