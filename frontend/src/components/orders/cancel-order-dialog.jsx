import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

export function CancelOrderDialog({
  open,
  onOpenChange,
  order,
  isSubmitting,
  onConfirm,
  title = "Cancelar pedido",
  reasonPlaceholder = "Ejemplo: cambie de opinion, error en la orden, ya no lo necesito",
}) {
  const [reason, setReason] = useState("")

  useEffect(() => {
    if (open) {
      setReason("")
    }
  }, [open])

  const isActiveOrder = order && !["delivered", "cancelled"].includes(order.status_code)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isActiveOrder
              ? "Si confirmas, el pedido sera cancelado y el restaurante sera notificado."
              : "Esto solo quitara el pedido de esta lista en tu dispositivo."}
          </DialogDescription>
        </DialogHeader>

        {isActiveOrder ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Motivo de cancelacion (opcional)</p>
            <Textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={reasonPlaceholder}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : isActiveOrder ? (
              "Cancelar pedido"
            ) : (
              "Eliminar de esta lista"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
