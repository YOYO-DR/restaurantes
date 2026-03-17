import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { AddressListSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/auth-context"
import { useCart } from "@/context/cart-context"
import { useCheckout, useCustomerAddresses } from "@/hooks/use-orders"
import { saveGuestOrder } from "@/lib/guest-orders"
import { formatCurrency, formatDeliveryWindow } from "@/lib/format"
import { CheckCircle2, Clock3, Loader2, MapPin, ShoppingBag } from "lucide-react"

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const { items, restaurant, orderType, tableId, tableNumber, clearCart } = useCart()
  const { addresses, isLoading: isLoadingAddresses, createAddress } = useCustomerAddresses(isAuthenticated)
  const { isSubmitting, submitOrder } = useCheckout()
  const [selectedAddressId, setSelectedAddressId] = useState("")
  const [notes, setNotes] = useState("")
  const [newAddress, setNewAddress] = useState({ label: "", line1: "", city: "", notes: "" })
  const [guestCustomer, setGuestCustomer] = useState({ name: "", email: "", phone: "", address: "" })

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [items],
  )
  const deliveryFee = orderType === "delivery" ? Number(restaurant?.delivery_fee_amount || 0) : 0
  const total = subtotal + deliveryFee

  useEffect(() => {
    if (isAuthenticated && user) {
      setGuestCustomer((current) => ({
        ...current,
        name: current.name || user.name || "",
        email: current.email || user.email || "",
      }))
    }
  }, [isAuthenticated, user])

  if (!items.length || !restaurant) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-muted/20 py-12">
          <div className="container mx-auto px-4">
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Tu carrito esta vacio.</p>
                <Button asChild className="mt-4">
                  <Link to="/restaurantes">Explorar restaurantes</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-muted/20 py-12">
        <div className="container mx-auto grid gap-8 px-4 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="space-y-6">
            <div>
              <Badge variant="secondary">Checkout</Badge>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">Confirma tu pedido</h1>
              <p className="mt-2 text-muted-foreground">
                Estas ordenando en {restaurant.name}. Revisa direccion, notas y total antes de confirmar.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Tipo de pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium capitalize">{orderType === "table" ? `Mesa ${tableNumber || "sin seleccionar"}` : orderType}</p>
                <div className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <Clock3 className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">Entrega estimada</p>
                    <p className="text-muted-foreground">
                      {formatDeliveryWindow(restaurant.estimated_min_minutes, restaurant.estimated_max_minutes)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {!isAuthenticated && orderType !== "table" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Datos de contacto</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="guest-name">Nombre</Label>
                    <Input id="guest-name" value={guestCustomer.name} onChange={(event) => setGuestCustomer((current) => ({ ...current, name: event.target.value }))} placeholder="Tu nombre" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-email">Correo</Label>
                    <Input id="guest-email" type="email" value={guestCustomer.email} onChange={(event) => setGuestCustomer((current) => ({ ...current, email: event.target.value }))} placeholder="tu@correo.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-phone">Telefono</Label>
                    <Input id="guest-phone" value={guestCustomer.phone} onChange={(event) => setGuestCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="3001234567" />
                  </div>
                  {orderType === "delivery" ? (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="guest-address">Direccion</Label>
                      <Textarea id="guest-address" rows={3} value={guestCustomer.address} onChange={(event) => setGuestCustomer((current) => ({ ...current, address: event.target.value }))} placeholder="Calle 5 #12-34, barrio, referencias" />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {isAuthenticated && orderType === "delivery" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Direccion de entrega</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {isLoadingAddresses ? <AddressListSkeleton /> : null}
                  {addresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => setSelectedAddressId(address.id)}
                      className={`w-full rounded-lg border p-4 text-left ${selectedAddressId === address.id ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <div className="flex items-start gap-3">
                        <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium">{address.label || "Direccion"}</p>
                          <p className="text-muted-foreground">{address.line1}</p>
                          <p className="text-muted-foreground">{address.city}</p>
                        </div>
                      </div>
                    </button>
                  ))}

                  <div className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        value={newAddress.label}
                        onChange={(event) => setNewAddress((current) => ({ ...current, label: event.target.value }))}
                        placeholder="Casa"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ciudad</Label>
                      <Input
                        value={newAddress.city}
                        onChange={(event) => setNewAddress((current) => ({ ...current, city: event.target.value }))}
                        placeholder="Corinto"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Direccion</Label>
                      <Input
                        value={newAddress.line1}
                        onChange={(event) => setNewAddress((current) => ({ ...current, line1: event.target.value }))}
                        placeholder="Calle 5 #12-34"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Notas</Label>
                      <Input
                        value={newAddress.notes}
                        onChange={(event) => setNewAddress((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="Casa blanca, porton verde"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await createAddress({
                              label: newAddress.label,
                              line1: newAddress.line1,
                              city: newAddress.city,
                              notes: newAddress.notes,
                              line2: "",
                              state: "",
                              country: "Colombia",
                              is_default: false,
                              address_type: addresses[0]?.address_type || null,
                            })
                            toast.success("Direccion guardada")
                            setNewAddress({ label: "", line1: "", city: "", notes: "" })
                          } catch (addressError) {
                            toast.error(addressError.message || "No fue posible guardar la direccion")
                          }
                        }}
                        disabled={!newAddress.label || !newAddress.line1 || !newAddress.city || !addresses[0]?.address_type}
                      >
                        Guardar nueva direccion
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Notas del pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Sin cebolla, llamar al llegar, etc."
                  rows={3}
                />
              </CardContent>
            </Card>
          </section>

          <aside>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{item.name} x{item.quantity}</span>
                      <span>{formatCurrency(item.price * item.quantity, item.currency)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {orderType === "delivery" ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Domicilio</span>
                      <span>{formatCurrency(deliveryFee)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-t border-border pt-3 font-semibold">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(total)}</span>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={async () => {
                    try {
                      const order = await submitOrder({
                        restaurant_id: restaurant.id,
                        order_type: orderType,
                        delivery_address_id: isAuthenticated && orderType === "delivery" ? selectedAddressId : null,
                        delivery_address_text: !isAuthenticated && orderType === "delivery" ? guestCustomer.address : null,
                        table_id: orderType === "table" ? tableId : null,
                        customer_name: guestCustomer.name,
                        customer_email: guestCustomer.email,
                        customer_phone: guestCustomer.phone,
                        customer_notes: notes,
                        items: items.map((item) => ({
                          menu_item_id: item.id,
                          quantity: item.quantity,
                        })),
                      })
                      toast.success(`Pedido ${order.order_code} creado con exito`)
                      if (order.guest_tracking_code) {
                        saveGuestOrder(order)
                      }
                      clearCart()
                      navigate(isAuthenticated ? "/dashboard/cliente/pedidos" : "/mis-pedidos", { replace: true })
                    } catch (submitError) {
                      toast.error(submitError.message || "No fue posible crear el pedido")
                    }
                  }}
                  disabled={
                    isSubmitting ||
                    (isAuthenticated && orderType === "delivery" && !selectedAddressId) ||
                    (orderType === "table" && !tableId) ||
                    (!isAuthenticated && orderType !== "table" && (!guestCustomer.email || !guestCustomer.phone)) ||
                    (!isAuthenticated && orderType === "delivery" && !guestCustomer.address)
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirmar pedido
                    </>
                  )}
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/restaurantes/${restaurant.slug}`}>
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Volver al menu
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}
