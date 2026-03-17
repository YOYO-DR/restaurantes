import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AddressListSkeleton } from "@/components/ui/app-skeletons"
import { useCustomerAddresses } from "@/hooks/use-orders"
import { Building, Home, MapPin, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

export default function ClientAddressesPage() {
  const { addresses, isLoading, error, createAddress, updateAddress, deleteAddress } = useCustomerAddresses()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)
  const [form, setForm] = useState({ label: "", line1: "", city: "", notes: "" })

  const sortedAddresses = useMemo(
    () => [...addresses].sort((a, b) => Number(b.is_default) - Number(a.is_default)),
    [addresses],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mis Direcciones</h2>
          <p className="text-muted-foreground">Administra tus direcciones de entrega</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingAddress(null)
                setForm({ label: "", line1: "", city: "", notes: "" })
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar direccion
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAddress ? "Editar direccion" : "Nueva Direccion"}</DialogTitle>
              <DialogDescription>Agrega o edita una direccion de entrega</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la direccion</Label>
                <Input id="name" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Casa, Oficina, etc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Direccion</Label>
                <Input id="address" value={form.line1} onChange={(event) => setForm((current) => ({ ...current, line1: event.target.value }))} placeholder="Calle, Carrera, etc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input id="city" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="Ciudad" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="details">Detalles adicionales</Label>
                <Input id="details" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Apartamento, referencias, etc." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={async () => {
                  try {
                    const payload = {
                      label: form.label,
                      line1: form.line1,
                      city: form.city,
                      notes: form.notes,
                      line2: "",
                      state: "",
                      country: "Colombia",
                      is_default: editingAddress?.is_default || addresses.length === 0,
                    }
                    if (editingAddress) {
                      await updateAddress(editingAddress.id, payload)
                      toast.success("Direccion actualizada")
                    } else {
                      await createAddress(payload)
                      toast.success("Direccion creada")
                    }
                    setIsDialogOpen(false)
                  } catch (saveError) {
                    toast.error(saveError.message || "No fue posible guardar la direccion")
                  }
                }}
                disabled={!form.label || !form.line1 || !form.city}
              >
                Guardar direccion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <AddressListSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {isLoading ? null : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedAddresses.map((address) => (
            <Card key={address.id} className={address.is_default ? "border-primary" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {address.address_type_code === "home" ? (
                      <Home className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Building className="h-5 w-5 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">{address.label || "Direccion"}</CardTitle>
                  </div>
                  {address.is_default ? <Badge>Principal</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">{address.line1}</p>
                      <p className="text-sm text-muted-foreground">{address.city}</p>
                    </div>
                  </div>
                  {address.notes ? <p className="pl-6 text-sm text-muted-foreground">{address.notes}</p> : null}
                </div>

                <div className="flex gap-2">
                  {!address.is_default ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        try {
                          await updateAddress(address.id, { is_default: true })
                          toast.success("Direccion principal actualizada")
                        } catch (updateError) {
                          toast.error(updateError.message || "No fue posible actualizar la direccion")
                        }
                      }}
                    >
                      Usar como principal
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingAddress(address)
                      setForm({
                        label: address.label || "",
                        line1: address.line1 || "",
                        city: address.city || "",
                        notes: address.notes || "",
                      })
                      setIsDialogOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={async () => {
                      try {
                        await deleteAddress(address.id)
                        toast.success("Direccion eliminada")
                      } catch (deleteError) {
                        toast.error(deleteError.message || "No fue posible eliminar la direccion")
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
