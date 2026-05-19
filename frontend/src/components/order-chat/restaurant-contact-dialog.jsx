import { useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getOrderContactInfo } from "@/services/order-chat"
import { Loader2, Mail, MapPin, Phone } from "lucide-react"

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"]

function format12h(time) {
  if (!time) return "--:--"
  const [hours, minutes] = time.split(":").map(Number)
  const period = hours >= 12 ? "PM" : "AM"
  const h12 = hours % 12 || 12
  return `${h12}:${String(minutes).padStart(2, "0")} ${period}`
}

export function RestaurantContactDialog({ open, onOpenChange, order, trackingCode }) {
  const [contact, setContact] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !order?.id) {
      return
    }

    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) {
        return
      }
      setIsLoading(true)
      setError("")
    })
    getOrderContactInfo(order.id, { trackingCode })
      .then((payload) => {
        if (cancelled) {
          return
        }
        setContact(payload)
      })
      .catch((loadError) => {
        if (cancelled) {
          return
        }
        setError(loadError.message || "No fue posible cargar la informacion")
      })
      .finally(() => {
        if (cancelled) {
          return
        }
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, order?.id, trackingCode])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contacto del restaurante</DialogTitle>
          <DialogDescription>
            Informacion de contacto para el pedido {order?.order_code || ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando informacion...
          </div>
        ) : null}

        {error ? <div className="text-sm text-destructive">{error}</div> : null}

        {contact ? (
          <div className="space-y-3 text-sm">
            <div className="font-medium">{contact.name}</div>
            {contact.phone ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{contact.phone}</span>
              </div>
            ) : null}
            {contact.email ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{contact.email}</span>
              </div>
            ) : null}
            {contact.address ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{contact.address}</span>
              </div>
            ) : null}

            {Array.isArray(contact.hours) && contact.hours.length > 0 ? (
              <div className="rounded-md border border-border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Horarios</p>
                <div className="space-y-1">
                    {contact.hours.map((entry) => {
                      const dayLabel = Number.isFinite(entry.weekday) && entry.weekday >= 0 && entry.weekday <= 6
                        ? WEEKDAY_LABELS[entry.weekday]
                        : `Dia ${entry.weekday}`
                      return (
                        <div key={`${entry.weekday}-${entry.open_time || "closed"}`} className="flex items-center justify-between text-xs">
                          <span>{dayLabel}</span>
                          <span>
                            {entry.is_closed ? "Cerrado" : `${format12h(entry.open_time)} - ${format12h(entry.close_time)}`}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
