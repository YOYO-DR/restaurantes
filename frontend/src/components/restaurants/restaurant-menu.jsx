import { useMemo, useState } from "react"
import { toast } from "sonner"
import { RestaurantMenuSkeleton } from "@/components/ui/app-skeletons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/format"
import { useCart } from "@/context/cart-context"
import { useAuth } from "@/context/auth-context"
import { useCustomerLoyalty } from "@/hooks/use-orders"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Info, Plus } from "lucide-react"

export function RestaurantMenu({ categories, restaurant, isLoading, error }) {
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const { addItem } = useCart()
  const { isAuthenticated } = useAuth()
  const {
    data: loyaltyData,
    isLoading: isLoadingLoyalty,
  } = useCustomerLoyalty(restaurant?.id || null, { enabled: Boolean(isAuthenticated && restaurant?.id) })

  const allItems = useMemo(
    () => categories.flatMap((category) => category.items.map((item) => ({ ...item, category: category.slug }))),
    [categories],
  )

  const filteredItems = activeCategory === "all"
    ? allItems
    : allItems.filter((item) => item.category === activeCategory)

  const visibleItems = filteredItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (activeFilter === "all" || (activeFilter === "popular" ? item.is_popular : item.is_available)),
  )

  if (isLoading) {
    return <RestaurantMenuSkeleton />
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>
  }

  const useSidebarNavigation = restaurant?.category_navigation === "sidebar"
  const useGridLayout = restaurant?.menu_layout === "grid"
  const useListLayout = restaurant?.menu_layout === "list"
  const containerClassName = useGridLayout
    ? "rounded-[2rem] border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur sm:p-6"
    : useListLayout
      ? "rounded-[1.75rem] border border-border/70 bg-background/90 p-4 shadow-sm sm:p-6"
      : "rounded-[1.75rem] bg-transparent"
  const navigationClassName = useSidebarNavigation
    ? "sticky top-16 z-40 rounded-[1.5rem] border border-border/70 bg-background/95 px-4 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
    : "sticky top-16 z-40 -mx-4 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60"

  return (
    <div className={useSidebarNavigation ? "gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]" : "space-y-6"}>
      <div className={navigationClassName}>
        <h2 className="mb-4 text-xl font-semibold">Menu</h2>
        {restaurant?.search_enabled ? (
          <Input
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="mb-4"
          />
        ) : null}
        {restaurant?.category_navigation === "dropdown" ? (
          <Select value={activeCategory} onValueChange={(value) => setActiveCategory(value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {categories.map((category) => <SelectItem key={category.id} value={category.slug}>{category.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className={`flex gap-2 ${useSidebarNavigation ? "flex-col" : "flex-wrap"}`}>
            <Button
              variant={activeCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory("all")}
              className="rounded-full"
              style={activeCategory === "all" ? { backgroundColor: restaurant?.primary_color || "#e85d04" } : undefined}
            >
              Todos
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={activeCategory === category.slug ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(category.slug)}
                className="rounded-full"
                style={activeCategory === category.slug ? { backgroundColor: restaurant?.primary_color || "#e85d04" } : undefined}
              >
                {category.name}
              </Button>
            ))}
          </div>
        )}
        {restaurant?.filters_enabled ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { value: "all", label: "Todos" },
              { value: "popular", label: "Populares" },
              { value: "available", label: "Disponibles" },
            ].map((filter) => (
              <Button
                key={filter.value}
                variant={activeFilter === filter.value ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                style={activeFilter === filter.value ? { backgroundColor: restaurant?.secondary_color || "#16a34a" } : undefined}
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`${useSidebarNavigation ? "mt-6 lg:mt-0" : ""} ${containerClassName}`}>
      <div className={useGridLayout ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
        {visibleItems.map((item) => (
          <Card key={item.id} className={`overflow-hidden ${useGridLayout ? "border-0 shadow-md" : ""} ${useListLayout ? "border-border/60 bg-card/80" : ""} ${!item.is_available ? "opacity-60" : ""}`}>
            {useGridLayout ? (
              <CardContent className="space-y-4 p-4">
                <div
                  className={`${restaurant?.image_size === "small" ? "h-36" : restaurant?.image_size === "large" ? "h-56" : "h-44"} w-full rounded-xl bg-muted bg-cover bg-center`}
                  style={item.image_url ? { backgroundImage: `url(${item.image_url})` } : undefined}
                />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    {restaurant?.show_tags && item.is_popular ? <Badge variant="secondary" className="text-xs">Popular</Badge> : null}
                    <FriendlyLoyaltyBadge item={item} isAuthenticated={isAuthenticated} loyaltyData={loyaltyData} isLoadingLoyalty={isLoadingLoyalty} />
                  </div>
                  {restaurant?.show_descriptions ? <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p> : null}
                </div>
                <div className="flex items-center justify-between">
                  {restaurant?.show_prices ? <span className="text-lg font-semibold" style={{ color: restaurant?.primary_color || "#e85d04" }}>{formatCurrency(item.price_amount, item.currency_code)}</span> : <span />}
                  <AddItemButton item={item} restaurant={restaurant} addItem={addItem} />
                </div>
              </CardContent>
            ) : (
              <CardContent className={useListLayout ? "flex items-center gap-3 p-3" : "flex gap-4 p-4"}>
                <div
                  className={`${useListLayout ? "h-14 w-14" : restaurant?.image_size === "small" ? "h-16 w-16" : restaurant?.image_size === "large" ? "h-28 w-28" : "h-24 w-24"} flex-shrink-0 rounded-lg bg-muted bg-cover bg-center`}
                  style={item.image_url ? { backgroundImage: `url(${item.image_url})` } : undefined}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{item.name}</h3>
                        {restaurant?.show_tags && item.is_popular ? <Badge variant="secondary" className="text-xs">Popular</Badge> : null}
                        <FriendlyLoyaltyBadge item={item} isAuthenticated={isAuthenticated} loyaltyData={loyaltyData} isLoadingLoyalty={isLoadingLoyalty} />
                      </div>
                      {restaurant?.show_descriptions ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p> : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {restaurant?.show_prices ? <span className="font-semibold" style={{ color: restaurant?.primary_color || "#e85d04" }}>{formatCurrency(item.price_amount, item.currency_code)}</span> : <span />}
                    <AddItemButton item={item} restaurant={restaurant} addItem={addItem} compact={useListLayout} />
                  </div>
                  {!item.is_available ? <p className="text-sm text-destructive">No disponible</p> : null}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
        {visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/80 px-6 py-12 text-center text-sm text-muted-foreground">
            No hay productos que coincidan con los filtros actuales.
          </div>
        ) : null}
      </div>
      </div>
    </div>
  )
}

function FriendlyLoyaltyBadge({ item, isAuthenticated, loyaltyData, isLoadingLoyalty }) {
  const earnsPoints = Boolean(item.earns_points)
  const allowsRedemption = Boolean(item.allows_points_redemption)
  const minPoints = Number(item.min_points_redeemable || 0)
  const maxPoints = item.max_points_redeemable == null ? null : Number(item.max_points_redeemable)
  const isProgramActive = Boolean(loyaltyData?.is_active)
  const shouldShowNoPoints = isAuthenticated && isProgramActive && !earnsPoints
  const currentPoints = Number(loyaltyData?.current_points || 0)
  const hasMinimum = currentPoints >= minPoints

  if (!earnsPoints && !allowsRedemption && !shouldShowNoPoints) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {earnsPoints ? (
        <LoyaltyPill text="Gana puntos" tone="green" hint="Gana puntos: cada peso que gastes en este plato suma para tu programa de fidelidad." />
      ) : null}

      {allowsRedemption ? (
        <LoyaltyPill
          text="Acepta canje"
          tone={isAuthenticated && !isLoadingLoyalty && !hasMinimum ? "amber" : "green"}
          hint={
            isAuthenticated && !isLoadingLoyalty
              ? hasMinimum
                ? `Acepta canje: puedes pagar parte de este plato con puntos. Tienes ${currentPoints} puntos (minimo ${minPoints}${maxPoints == null ? "" : `, maximo ${maxPoints}`}).`
                : `Acepta canje: puedes pagar parte de este plato con puntos. Te faltan ${Math.max(minPoints - currentPoints, 0)} puntos para alcanzar el minimo ${minPoints}.`
              : `Acepta canje: puedes pagar parte de este plato con puntos (minimo ${minPoints}${maxPoints == null ? "" : `, maximo ${maxPoints}`}).`
          }
        />
      ) : null}

      {shouldShowNoPoints ? (
        <LoyaltyPill
          text="No otorga puntos"
          tone="muted"
          hint="No otorga puntos: este producto no acumula puntos por decision del restaurante."
        />
      ) : null}
    </div>
  )
}

function LoyaltyPill({ text, hint, tone }) {
  const toneClass = tone === "amber"
    ? "text-amber-700"
    : tone === "muted"
      ? "text-muted-foreground"
      : "text-emerald-700"
  return (
    <Badge variant="outline" className={`text-xs ${toneClass} gap-1`}>
      <span>{text}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={`Info ${text}`} className="hover:text-foreground">
            <Info className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-w-xs text-xs leading-relaxed">{hint}</PopoverContent>
      </Popover>
    </Badge>
  )
}

function AddItemButton({ item, restaurant, addItem, compact = false }) {
  return (
    <Button
      size="sm"
      disabled={!item.is_available}
      className={compact ? "h-8 rounded-full px-3" : "h-8 w-8 rounded-full p-0"}
      onClick={() => {
        addItem(
          {
            id: item.id,
            name: item.name,
            price: Number(item.price_amount),
            currency: item.currency_code,
            earns_points: Boolean(item.earns_points),
            allows_points_redemption: Boolean(item.allows_points_redemption),
            min_points_redeemable: item.min_points_redeemable ?? 0,
            max_points_redeemable: item.max_points_redeemable ?? null,
          },
          restaurant
            ? {
                id: restaurant.id,
                name: restaurant.name,
                slug: restaurant.slug,
                delivery_fee_amount: restaurant.delivery_fee_amount,
                has_table_order: restaurant.has_table_order,
                tables: restaurant.tables || [],
              }
            : null,
        )
        toast.success(`${item.name} agregado al carrito`)
      }}
    >
      <Plus className="h-4 w-4" />
    </Button>
  )
}
