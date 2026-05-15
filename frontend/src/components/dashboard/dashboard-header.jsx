import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AlertTriangle, Bell, CheckCheck, Package, Settings, LogOut, User, Menu } from "lucide-react"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { useAuth } from "@/context/auth-context"
import { useNotificationCenter } from "@/hooks/use-orders"

const RESTAURANT_ROLES = new Set(["restaurante", "dueno", "operador"])

function getNotificationMeta(item, activeRole) {
  const p = item.payload_json || {}
  const eventType = p.event_type || item.type_code?.replace(/_/g, ".")

  const isRestaurant = RESTAURANT_ROLES.has(activeRole)
  const ordersPath = isRestaurant ? "/dashboard/restaurante/pedidos" : "/dashboard/cliente/pedidos"

  switch (eventType) {
    case "order.created": {
      const bodyParts = [p.order_type_name]
      if (isRestaurant) {
        bodyParts.push(p.customer_name || "Cliente")
      } else {
        bodyParts.push(p.restaurant_name)
      }
      return {
        title: `Nuevo pedido ${p.order_code || ""}`.trim(),
        body: bodyParts.filter(Boolean).join(" · "),
        actionPath: ordersPath,
        icon: Package,
      }
    }
    case "order.cancelled":
      return {
        title: `Pedido cancelado ${p.order_code || ""}`.trim(),
        body: p.cancel_reason || (p.cancelled_by ? `Por ${p.cancelled_by}` : ""),
        actionPath: ordersPath,
        icon: Package,
      }
    case "order.status_changed":
      return {
        title: `Pedido ${p.order_code || ""}`.trim(),
        body: p.status_name ? `Estado: ${p.status_name}` : "",
        actionPath: ordersPath,
        icon: Package,
      }
    case "inventory.low_stock":
      return {
        title: `Stock bajo: ${p.item_name || p.menu_item_name || "producto"}`,
        body: p.current_stock != null ? `${p.current_stock} unidades restantes` : "Revisar inventario",
        actionPath: "/dashboard/restaurante/inventario",
        icon: AlertTriangle,
      }
    case "inventory.out_of_stock":
      return {
        title: `Agotado: ${p.item_name || p.menu_item_name || "producto"}`,
        body: "Sin existencias en inventario",
        actionPath: "/dashboard/restaurante/inventario",
        icon: AlertTriangle,
      }
    case "customer.first_order":
      return {
        title: "Primer pedido de cliente",
        body: p.customer_name || p.order_code || "",
        actionPath: "/dashboard/restaurante/clientes",
        icon: Package,
      }
    default:
      return {
        title: "Notificacion",
        body: "",
        actionPath: null,
        icon: Package,
      }
  }
}

function getDashboardPath(role) {
  if (role === "admin") return "/dashboard/admin"
  if (role === "restaurante" || role === "dueno") return "/dashboard/restaurante"
  return "/dashboard/cliente"
}

export function DashboardHeader({ userName, userType, onMobileMenuClick }) {
  const navigate = useNavigate()
  const { logout, activeRole, availableRoles, switchRole } = useAuth()
  const { unreadCount, items, markAllRead } = useNotificationCenter()
  const [isNotifOpen, setIsNotifOpen] = useState(false)

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const dashboardPath =
    userType === "admin"
      ? "/dashboard/admin"
      : userType === "dueno"
        ? "/dashboard/restaurante"
        : "/dashboard/cliente"

  const handleNotifClick = (actionPath) => {
    if (!actionPath) return
    setIsNotifOpen(false)
    navigate(actionPath)
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {onMobileMenuClick ? (
          <Button variant="ghost" size="icon" className="size-9 lg:hidden" onClick={onMobileMenuClick}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        ) : null}

        <h1 className="truncate text-base font-semibold sm:text-lg">
          {userType === "cliente" && "Mi Cuenta"}
          {userType === "dueno" && "Mi Restaurante"}
          {userType === "admin" && "Administracion"}
        </h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
        {availableRoles.length > 1 ? (
          <Select
            value={activeRole}
            onValueChange={(value) => {
              const nextRole = switchRole(value)
              navigate(getDashboardPath(nextRole))
            }}
          >
            <SelectTrigger className="hidden md:flex w-[180px]">
              <SelectValue placeholder="Selecciona un rol" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role.code} value={role.code}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <ThemeToggle />

        <Popover open={isNotifOpen} onOpenChange={setIsNotifOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                  {unreadCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="font-semibold">Notificaciones</p>
              {unreadCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={markAllRead}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar leidas
                </Button>
              ) : null}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 opacity-30" />
                  <p>Sin notificaciones</p>
                </div>
              ) : (
                items.map((item) => {
                  const meta = getNotificationMeta(item, activeRole)
                  const Icon = meta.icon
                  const isClickable = Boolean(meta.actionPath)
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNotifClick(meta.actionPath)}
                      className={`flex items-start gap-3 border-b border-border px-4 py-3 last:border-0 transition-colors ${!item.read_at ? "bg-primary/5" : ""} ${isClickable ? "cursor-pointer hover:bg-muted/60" : ""}`}
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{meta.title}</p>
                        {meta.body ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{meta.body}</p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-muted-foreground/70">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                      {!item.read_at ? (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {availableRoles.find((role) => role.code === activeRole)?.label ||
                    (userType === "cliente" ? "Cliente" : userType === "dueno" ? "Dueno de restaurante" : "Administrador")}
                </p>
              </div>
            </DropdownMenuLabel>
            {availableRoles.length > 1 ? (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Perfil activo</p>
                  <Select
                    value={activeRole}
                    onValueChange={(value) => {
                      const nextRole = switchRole(value)
                      navigate(getDashboardPath(nextRole))
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.code} value={role.code}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={`${dashboardPath}/perfil`}>
                <User className="mr-2 h-4 w-4" />
                <span>Mi perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`${dashboardPath}/configuracion`}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuracion</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await logout()
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar sesion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
