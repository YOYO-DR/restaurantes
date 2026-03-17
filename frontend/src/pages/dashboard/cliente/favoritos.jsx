import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RestaurantGridSkeleton } from "@/components/ui/app-skeletons"
import { useCustomerFavorites } from "@/hooks/use-orders"
import { formatDeliveryWindow } from "@/lib/format"
import { Clock, Heart, Star, Truck } from "lucide-react"

export default function ClientFavoritesPage() {
  const { favorites, isLoading, error, removeFavorite } = useCustomerFavorites()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mis Favoritos</h2>
        <p className="text-muted-foreground">Restaurantes que has guardado como favoritos</p>
      </div>

      {isLoading ? <RestaurantGridSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {isLoading ? null : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((favorite) => (
            <Card key={favorite.id} className="group overflow-hidden transition-all hover:shadow-lg">
              <div className="relative aspect-video bg-muted">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8 rounded-full bg-background/80 text-destructive hover:bg-background hover:text-destructive"
                  onClick={async () => {
                    try {
                      await removeFavorite(favorite.id)
                      toast.success("Favorito eliminado")
                    } catch (deleteError) {
                      toast.error(deleteError.message || "No fue posible eliminar el favorito")
                    }
                  }}
                >
                  <Heart className="h-4 w-4 fill-current" />
                </Button>
                <div className="absolute bottom-3 left-3 right-3">
                  <Badge variant={favorite.restaurant_is_open ? "default" : "secondary"} className="mb-2">
                    {favorite.restaurant_is_open ? "Abierto" : "Cerrado"}
                  </Badge>
                  <h3 className="text-lg font-semibold text-white">{favorite.restaurant_name}</h3>
                  <p className="text-sm text-white/80">{favorite.restaurant_category}</p>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{favorite.restaurant_rating}</span>
                    <span className="text-sm text-muted-foreground">({favorite.restaurant_reviews})</span>
                  </div>
                  {favorite.restaurant_has_delivery ? <Truck className="h-4 w-4 text-muted-foreground" /> : null}
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDeliveryWindow(favorite.estimated_min_minutes, favorite.estimated_max_minutes)}</span>
                  </div>
                </div>
                <Button className="mt-4 w-full" asChild>
                  <Link to={`/restaurantes/${favorite.restaurant_slug}`}>Ver Menu</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
