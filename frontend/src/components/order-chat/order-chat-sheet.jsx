import { useEffect } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { OrderChatComposer } from "@/components/order-chat/order-chat-composer"
import { OrderChatMessageList } from "@/components/order-chat/order-chat-message-list"
import { useOrderChat } from "@/hooks/use-order-chat"
import { usePlatformChatConfig } from "@/hooks/use-platform-chat-config"

export function OrderChatSheet({ open, onOpenChange, order, side = "customer", trackingCode }) {
  const { config } = usePlatformChatConfig()
  const {
    chat,
    messages,
    unreadCount,
    isLoading,
    isSending,
    error,
    sendMessage,
    markRead,
  } = useOrderChat({
    orderId: order?.id,
    trackingCode,
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      return
    }
    markRead().catch(() => undefined)
  }, [markRead, open])

  const isClosed = Boolean(chat?.is_closed)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>Chat del pedido</SheetTitle>
            {isClosed ? <Badge variant="outline">Cerrado</Badge> : null}
            {unreadCount > 0 ? <Badge>{unreadCount}</Badge> : null}
          </div>
          <SheetDescription>
            {order?.order_code ? `Pedido ${order.order_code}` : "Conversacion"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3 px-2 sm:px-3">
          {isLoading ? <p className="text-sm text-muted-foreground">Cargando chat...</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <OrderChatMessageList messages={messages} currentSide={side} />

          <OrderChatComposer
            config={config}
            disabled={isClosed}
            isSending={isSending}
            onSend={async (payload) => {
              try {
                await sendMessage(payload)
              } catch (sendError) {
                toast.error(sendError.message || "No fue posible enviar el mensaje")
              }
            }}
          />

          {isClosed ? (
            <p className="text-xs text-muted-foreground">
              Este chat fue cerrado automaticamente despues del tiempo de retencion.
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
