import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfilePageSkeleton } from "@/components/ui/app-skeletons"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAccountProfile, useCustomerDashboard } from "@/hooks/use-orders"
import { Camera, Loader2 } from "lucide-react"

export default function ClientProfilePage() {
  const { profile, isLoading, isSaving, error, saveProfile } = useAccountProfile()
  const { data: dashboardData } = useCustomerDashboard()
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" })

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
      })
    }
  }, [profile])

  if (isLoading) {
    return <ProfilePageSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mi Perfil</h2>
        <p className="text-muted-foreground">Administra tu informacion personal</p>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center py-8">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                  {formData.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("") || "U"}
                </AvatarFallback>
              </Avatar>
              <Button size="icon" variant="outline" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full" disabled>
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <h3 className="mt-4 text-lg font-semibold">{formData.name}</h3>
            <p className="text-sm text-muted-foreground">{formData.email}</p>
            <div className="mt-4 flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1">
              <span className="text-sm font-medium text-primary">Nivel {dashboardData.loyalty.tier}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informacion Personal</CardTitle>
            <CardDescription>Actualiza tus datos personales</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (event) => {
                event.preventDefault()
                try {
                  await saveProfile(formData)
                  toast.success("Perfil actualizado")
                } catch (saveError) {
                  toast.error(saveError.message || "No fue posible guardar el perfil")
                }
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo electronico</Label>
                <Input id="email" type="email" value={formData.email} onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input id="phone" type="tel" value={formData.phone} onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))} />
              </div>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
