import { Badge } from "@/components/ui/badge"
import { RestaurantHeaderSkeleton } from "@/components/ui/app-skeletons"
import { formatCurrency, formatDeliveryWindow } from "@/lib/format"
import { Clock, Facebook, Instagram, MapPin, MessageCircle, ShoppingBag, Star, Truck } from "lucide-react"

function TikTokIcon(props) {
  return <span {...props}>TT</span>
}

function buildSocialLinks(restaurant) {
  const socialLinks = restaurant?.social_links || {}

  return [
    socialLinks.instagram_url ? { label: "Instagram", href: socialLinks.instagram_url, icon: Instagram } : null,
    socialLinks.facebook_url ? { label: "Facebook", href: socialLinks.facebook_url, icon: Facebook } : null,
    socialLinks.tiktok_url ? { label: "TikTok", href: socialLinks.tiktok_url, icon: TikTokIcon } : null,
    socialLinks.whatsapp_number
      ? {
          label: "WhatsApp",
          href: `https://wa.me/${String(socialLinks.whatsapp_number).replace(/\D/g, "")}`,
          icon: MessageCircle,
        }
      : null,
  ].filter(Boolean)
}

export function RestaurantHeader({ restaurant, isLoading }) {
  if (isLoading || !restaurant) {
    return <RestaurantHeaderSkeleton />
  }

  const socialLinks = buildSocialLinks(restaurant)
  const hasContactDetails = restaurant.phone || restaurant.email || socialLinks.length > 0

  return (
    <section className="border-b border-border bg-muted/30">
      <div
        className="relative h-48 md:h-64"
        style={{
          background: restaurant.cover_url
            ? `linear-gradient(to right, rgba(18, 18, 18, 0.45), rgba(18, 18, 18, 0.15)), url(${restaurant.cover_url}) center/cover`
            : `linear-gradient(135deg, ${restaurant.primary_color || "#e85d04"}33, ${restaurant.secondary_color || "#16a34a"}38)`,
        }}
      />
      <div className="container mx-auto px-4">
        <div className="relative -mt-16 flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
          <div className="flex h-32 w-32 items-center justify-center rounded-xl border-4 border-background bg-card shadow-lg">
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt={restaurant.name} className="h-full w-full rounded-lg object-cover" />
            ) : (
              <span className="text-4xl font-bold" style={{ color: restaurant.primary_color || "#e85d04" }}>{restaurant.name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 pb-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className="text-2xl font-bold md:text-3xl"
                style={{ textShadow: "0 1px 2px rgba(255, 255, 255, 0.45), 0 2px 10px rgba(0, 0, 0, 0.35)" }}
              >
                {restaurant.name}
              </h1>
              <Badge variant={restaurant.is_open ? "default" : "secondary"}>
                {restaurant.is_open ? "Abierto" : "Cerrado"}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{restaurant.category}{restaurant.slogan ? ` - ${restaurant.slogan}` : ""}</p>
            {restaurant.welcome_message ? <p className="mt-2 max-w-2xl text-sm font-medium" style={{ color: restaurant.primary_color || "#e85d04" }}>{restaurant.welcome_message}</p> : null}
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{restaurant.description}</p>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{restaurant.average_rating}</span>
                <span className="text-muted-foreground">({restaurant.total_reviews} resenas)</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{restaurant.schedule?.[0]?.label || "Horario no disponible"}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{restaurant.address?.line1 || "Direccion no disponible"}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {restaurant.has_delivery ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <div className="text-sm">
                    <span className="font-medium" style={{ color: restaurant.primary_color || "#e85d04" }}>Delivery</span>
                    <span className="text-muted-foreground">
                      {" "}
                      {formatDeliveryWindow(restaurant.estimated_min_minutes, restaurant.estimated_max_minutes)} - {formatCurrency(restaurant.delivery_fee_amount)}
                    </span>
                  </div>
                </div>
              ) : null}
              {restaurant.has_pickup ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <div className="text-sm">
                    <span className="font-medium" style={{ color: restaurant.primary_color || "#e85d04" }}>Pickup</span>
                    <span className="text-muted-foreground"> disponible</span>
                  </div>
                </div>
              ) : null}
            </div>

            {hasContactDetails ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {restaurant.phone ? (
                  <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
                    {restaurant.phone}
                  </span>
                ) : null}
                {restaurant.email ? (
                  <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
                    {restaurant.email}
                  </span>
                ) : null}
                {socialLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-foreground transition-colors hover:bg-muted"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </a>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
