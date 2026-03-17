import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RestaurantGridSkeleton } from "@/components/ui/app-skeletons"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { formatCurrency, formatDeliveryWindow } from "@/lib/format"
import { Clock, MapPin, Star, Store, Truck } from "lucide-react"

export function RestaurantGrid({ restaurants, isLoading, error }) {
  if (isLoading) {
    return <RestaurantGridSkeleton />
  }

  if (error) {
    return <div className="mt-8 text-sm text-destructive">{error}</div>
  }

  if (!restaurants.length) {
    return (
      <Empty className="mt-8 border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Store className="h-5 w-5" />
          </EmptyMedia>
          <EmptyTitle>No encontramos restaurantes</EmptyTitle>
          <EmptyDescription>Prueba con otra busqueda o cambia la categoria.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {restaurants.map((restaurant) => (
        <Link key={restaurant.id} to={`/restaurantes/${restaurant.slug}`}>
          <Card className="group overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg">
            <div className="relative aspect-video bg-muted">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: restaurant.cover_url
                    ? `linear-gradient(to top, rgba(0, 0, 0, 0.65), transparent), url(${restaurant.cover_url})`
                    : "linear-gradient(135deg, rgba(214, 93, 14, 0.18), rgba(32, 96, 61, 0.22))",
                }}
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div>
                  <Badge variant={restaurant.is_open ? "default" : "secondary"} className="mb-2">
                    {restaurant.is_open ? "Abierto" : "Cerrado"}
                  </Badge>
                  <h3 className="text-lg font-semibold text-white">{restaurant.name}</h3>
                  <p className="text-sm text-white/80">{restaurant.category}</p>
                </div>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{restaurant.average_rating}</span>
                  <span className="text-sm text-muted-foreground">({restaurant.total_reviews})</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {restaurant.has_delivery ? (
                    <div className="flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5" />
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDeliveryWindow(restaurant.estimated_min_minutes, restaurant.estimated_max_minutes)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{restaurant.city || "Sin ciudad"}</span>
                </div>
              </div>
              {restaurant.has_delivery ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Domicilio: {formatCurrency(restaurant.delivery_fee_amount)}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
