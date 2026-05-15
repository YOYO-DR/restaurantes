import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Utensils, Home, ShoppingBag, Star, MapPin, Heart, User, Settings } from "lucide-react";
const menuItems = [
    {
        title: "Inicio",
        href: "/dashboard/cliente",
        icon: Home
    },
    {
        title: "Mis Pedidos",
        href: "/dashboard/cliente/pedidos",
        icon: ShoppingBag
    },
    {
        title: "Mis Puntos",
        href: "/dashboard/cliente/puntos",
        icon: Star
    },
    {
        title: "Direcciones",
        href: "/dashboard/cliente/direcciones",
        icon: MapPin
    },
    {
        title: "Favoritos",
        href: "/dashboard/cliente/favoritos",
        icon: Heart
    },
    {
        title: "Mi Perfil",
        href: "/dashboard/cliente/perfil",
        icon: User
    },
    {
        title: "Configuracion",
        href: "/dashboard/cliente/configuracion",
        icon: Settings
    }
];
export function ClientSidebar({ className, onNavigate }) {
    const { pathname } = useLocation();
  return (<aside className={cn("flex h-dvh w-64 flex-shrink-0 flex-col border-r border-border bg-sidebar", className)}>
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Utensils className="h-4 w-4 text-sidebar-primary-foreground"/>
          </div>
          <span className="text-lg font-bold">FoodHub</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {menuItems.map((item) => {
            const isActive = pathname === item.href;
              return (<Link key={item.href} to={item.href} onClick={onNavigate} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}>
              <item.icon className="h-4 w-4"/>
              {item.title}
            </Link>);
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Link to="/restaurantes" onClick={onNavigate} className="flex items-center justify-center gap-2 rounded-lg bg-sidebar-primary px-4 py-2 text-sm font-medium text-sidebar-primary-foreground transition-colors hover:bg-sidebar-primary/90">
          <Utensils className="h-4 w-4"/>
          Ver Restaurantes
        </Link>
      </div>
    </aside>);
}
