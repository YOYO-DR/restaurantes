import { Link } from "react-router-dom"
import { useLocation } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { useOwnerOrdersContext } from "@/context/owner-orders-context"
import { useOwnerRestaurants } from "@/hooks/use-restaurants"
import { cn } from "@/lib/utils"
import { BarChart3, Home, Package, Palette, QrCode, Settings, ShoppingBag, Star, User, Users, Utensils, UtensilsCrossed } from "lucide-react"

const menuItems = [
  {
    title: "Dashboard",
    href: "/dashboard/restaurante",
    icon: Home,
  },
  {
    title: "Pedidos",
    href: "/dashboard/restaurante/pedidos",
    icon: ShoppingBag,
    showPendingBadge: true,
  },
  {
    title: "Menu",
    href: "/dashboard/restaurante/menu",
    icon: UtensilsCrossed,
  },
  {
    title: "Inventario",
    href: "/dashboard/restaurante/inventario",
    icon: Package,
  },
  {
    title: "Clientes",
    href: "/dashboard/restaurante/clientes",
    icon: Users,
  },
  {
    title: "Resenas",
    href: "/dashboard/restaurante/resenas",
    icon: Star,
  },
  {
    title: "Analiticas",
    href: "/dashboard/restaurante/analiticas",
    icon: BarChart3,
  },
  {
    title: "Codigo QR",
    href: "/dashboard/restaurante/qr",
    icon: QrCode,
  },
  {
    title: "Personalizacion",
    href: "/dashboard/restaurante/personalizacion",
    icon: Palette,
  },
  {
    title: "Mi Perfil",
    href: "/dashboard/restaurante/perfil",
    icon: User,
  },
  {
    title: "Configuracion",
    href: "/dashboard/restaurante/configuracion",
    icon: Settings,
  },
]

export function OwnerSidebar({ className, onNavigate }) {
  const { pathname } = useLocation()
  const { restaurants } = useOwnerRestaurants()
  const { unfinishedOrdersCount } = useOwnerOrdersContext()
  const restaurantName = restaurants[0]?.name || restaurants[0]?.business_name || "Tu restaurante"

  return (<aside className={cn("flex h-screen w-64 flex-shrink-0 flex-col border-r border-border bg-sidebar", className)}>
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Utensils className="h-4 w-4 text-sidebar-primary-foreground"/>
          </div>
          <span className="text-lg font-bold">FoodHub</span>
        </Link>
      </div>

      <div className="px-4 py-4">
        <div className="rounded-lg bg-sidebar-accent p-3">
          <p className="text-xs text-muted-foreground">Tu restaurante</p>
          <p className="font-semibold">{restaurantName}</p>
          <div className="mt-1 flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-muted-foreground">Abierto</span>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 pb-4">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          const badgeValue = item.showPendingBadge ? unfinishedOrdersCount : null

          return (<Link key={item.href} to={item.href} onClick={onNavigate} className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}>
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4"/>
                {item.title}
              </div>
              {badgeValue ? (<Badge variant="default" className="h-5 px-1.5 text-xs">
                  {badgeValue}
                </Badge>) : null}
            </Link>)
        })}
      </nav>
    </aside>)
}
