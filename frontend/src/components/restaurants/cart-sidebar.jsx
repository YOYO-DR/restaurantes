import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCart } from "@/context/cart-context"
import { formatCurrency } from "@/lib/format"
import { Minus, Plus, ShoppingBag, Trash2, Truck, UtensilsCrossed } from "lucide-react"

export function CartSidebar({ restaurant, compact = false, inline = false }) {
  const { items, orderType, setOrderType, tableId, setTableId, tableNumber, setTableNumber, updateQuantity, removeItem } = useCart()

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const deliveryFee = orderType === "delivery" ? Number(restaurant?.delivery_fee_amount || 0) : 0
  const total = subtotal + deliveryFee
  const availableTables = restaurant?.tables || []

  const handleOrderTypeChange = (value) => {
    setOrderType(value)
    if (value !== "table") {
      setTableId("")
      setTableNumber("")
    }
  }

  const handleTableChange = (value) => {
    const selectedTable = availableTables.find((table) => table.id === value)
    setTableId(value)
    setTableNumber(selectedTable?.table_number || "")
  }

  const cardClassName = inline
    ? "border-0 bg-transparent shadow-none"
    : compact
    ? restaurant?.cart_position === "floating"
      ? "border border-border/60 bg-background/95 shadow-2xl backdrop-blur"
      : "border border-border/60 bg-background/95 shadow-lg backdrop-blur"
    : "sticky top-24 border border-border/60 bg-background/95 shadow-sm backdrop-blur"

  if (items.length === 0) {
    return (
        <Card className={inline ? "border-0 bg-transparent shadow-none" : "sticky top-24"}>
        <CardContent className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-12"}`}>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-semibold">Tu carrito esta vacio</h3>
          <p className="mt-1 text-sm text-muted-foreground">Agrega productos del menu para hacer tu pedido</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`${cardClassName} min-w-0 overflow-x-hidden`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Tu pedido</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-6 overflow-x-hidden">
        <RadioGroup value={orderType} onValueChange={handleOrderTypeChange} className="grid grid-cols-3 gap-2">
          <div>
            <RadioGroupItem value="delivery" id="delivery" className="peer sr-only" />
            <Label htmlFor="delivery" className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-border p-3 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5">
              <Truck className="mb-1 h-4 w-4" />
              <span className="text-xs font-medium">Delivery</span>
            </Label>
          </div>
          <div>
            <RadioGroupItem value="pickup" id="pickup" className="peer sr-only" />
            <Label htmlFor="pickup" className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-border p-3 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5">
              <ShoppingBag className="mb-1 h-4 w-4" />
              <span className="text-xs font-medium">Pickup</span>
            </Label>
          </div>
          <div>
            <RadioGroupItem value="table" id="table" className="peer sr-only" disabled={!restaurant?.has_table_order || availableTables.length === 0} />
            <Label htmlFor="table" className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-border p-3 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5">
              <UtensilsCrossed className="mb-1 h-4 w-4" />
              <span className="text-xs font-medium">En Mesa</span>
            </Label>
          </div>
        </RadioGroup>

        {orderType === "table" ? (
          <div className="space-y-2">
            <Label className="text-sm">Numero de mesa</Label>
            <Select value={tableId} onValueChange={handleTableChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tu mesa" />
              </SelectTrigger>
              <SelectContent>
                {availableTables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>Mesa {table.table_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-sm text-primary">{formatCurrency(item.price, item.currency)}</p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, -1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {orderType === "delivery" ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Domicilio</span>
              <span>{formatCurrency(deliveryFee)}</span>
            </div>
          ) : null}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        <Button className="w-full" size="lg" asChild disabled={orderType === "table" && !tableId}>
          <Link to="/checkout">
            {orderType === "table" ? (tableNumber ? `Pedir a Mesa ${tableNumber}` : "Selecciona tu mesa") : "Continuar con el pedido"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
