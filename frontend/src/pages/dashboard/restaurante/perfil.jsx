import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfilePageSkeleton } from "@/components/ui/app-skeletons"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAccountProfile } from "@/hooks/use-orders"
import { Check, Loader2, Upload, X } from "lucide-react"

export default function PerfilRestaurantePage() {
  const { profile, isLoading, isSaving, error, saveProfile } = useAccountProfile()
  const [form, setForm] = useState({ name: "", email: "", phone: "" })
  const [avatarPreview, setAvatarPreview] = useState("")
  const [avatarFile, setAvatarFile] = useState(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
      })
      setAvatarPreview(profile.avatar_url || "")
    }
  }, [profile])

  const initials = form.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "U"

  if (isLoading) {
    return <ProfilePageSkeleton showBadge showSecondaryMeta />
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setRemoveAvatar(false)
    event.target.value = ""
  }

  function handleRemoveAvatar() {
    setAvatarFile(null)
    setAvatarPreview("")
    setRemoveAvatar(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-muted-foreground">Administra tu informacion personal</p>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview} alt={form.name} />
                <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              <Button
                type="button"
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-3 w-3" />
                Cambiar foto
              </Button>
              {avatarPreview ? (
                <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleRemoveAvatar}>
                  <X className="mr-1 h-3 w-3" />
                  Quitar foto
                </Button>
              ) : null}
              <h2 className="mt-2 text-xl font-semibold">{form.name}</h2>
              <p className="text-sm text-muted-foreground">Propietario</p>
              {profile?.is_verified ? (
                <Badge variant="secondary" className="mt-2">
                  <Check className="mr-1 h-3 w-3" />
                  Cuenta verificada
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-2">
                  Cuenta pendiente de verificacion
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informacion Personal</CardTitle>
            <CardDescription>Actualiza tu informacion de contacto</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault()
                try {
                  await saveProfile({
                    ...form,
                    ...(avatarFile ? { avatar_file: avatarFile } : {}),
                    ...(removeAvatar ? { remove_avatar: true } : {}),
                  })
                  setAvatarFile(null)
                  setRemoveAvatar(false)
                  toast.success("Perfil actualizado")
                } catch (saveError) {
                  toast.error(saveError.message || "No fue posible actualizar el perfil")
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electronico</Label>
                  <Input id="email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input id="phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
              </div>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
