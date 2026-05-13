import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { useOwnerRestaurantPersonalization } from "@/hooks/use-restaurants"
import { Eye, Layout, Loader2, Palette, Type, Upload } from "lucide-react"

const colorPresets = [
  { name: "Naranja", value: "#e85d04" },
  { name: "Rojo", value: "#dc2626" },
  { name: "Verde", value: "#16a34a" },
  { name: "Azul", value: "#2563eb" },
  { name: "Morado", value: "#9333ea" },
  { name: "Rosa", value: "#ec4899" },
]

export default function PersonalizacionRestaurantePage() {
  const { data, isLoading, isSaving, error, savePersonalization } = useOwnerRestaurantPersonalization()
  const [form, setForm] = useState(null)
  const logoInputRef = useRef(null)
  const coverInputRef = useRef(null)

  useEffect(() => {
    if (data) {
      setForm(data)
    }
  }, [data])

  if (isLoading || !form) {
    return <DashboardShellSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personalizacion</h1>
          <p className="text-muted-foreground">Personaliza la apariencia de tu menu digital</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" asChild>
            <a href={`/restaurantes/${data.slug}`} target="_blank" rel="noopener noreferrer">
              <Eye className="mr-2 h-4 w-4" />
              Vista Previa
            </a>
          </Button>
          <Button
            disabled={isSaving}
            onClick={async () => {
              try {
                await savePersonalization(form)
                toast.success("Personalizacion guardada")
              } catch (saveError) {
                toast.error(saveError.message || "No fue posible guardar la personalizacion")
              }
            }}
          >
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Cambios"}
          </Button>
        </div>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="branding" className="gap-2"><Palette className="h-4 w-4" />Marca</TabsTrigger>
          <TabsTrigger value="layout" className="gap-2"><Layout className="h-4 w-4" />Diseno</TabsTrigger>
          <TabsTrigger value="content" className="gap-2"><Type className="h-4 w-4" />Contenido</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Logo y Banner</CardTitle>
                <CardDescription>Sube archivos o usa URLs para tu marca actual.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ImageUploadField
                  label="Logo del restaurante"
                  previewUrl={form.logo_preview || form.logo_url}
                  helperText="PNG, JPG o WEBP. Recomendado: 200x200px"
                  inputRef={logoInputRef}
                  onFileSelect={(file) => setForm((current) => ({ ...current, logo_file: file, logo_preview: URL.createObjectURL(file), remove_logo: false }))}
                  onRemove={() => setForm((current) => ({ ...current, logo_file: null, logo_preview: "", logo_url: "", remove_logo: true }))}
                />
                <Field label="URL del logo" value={form.logo_url} onChange={(value) => setForm((current) => ({ ...current, logo_url: value }))} />
                <ImageUploadField
                  label="Imagen de portada"
                  previewUrl={form.cover_preview || form.cover_url}
                  helperText="Recomendado: 1200x400px"
                  wide
                  inputRef={coverInputRef}
                  onFileSelect={(file) => setForm((current) => ({ ...current, cover_file: file, cover_preview: URL.createObjectURL(file), remove_cover: false }))}
                  onRemove={() => setForm((current) => ({ ...current, cover_file: null, cover_preview: "", cover_url: "", remove_cover: true }))}
                />
                <Field label="URL de portada" value={form.cover_url} onChange={(value) => setForm((current) => ({ ...current, cover_url: value }))} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Colores</CardTitle>
                <CardDescription>Define los colores principales de la tienda.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Color principal</Label>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: form.primary_color }} />
                    <Input value={form.primary_color} onChange={(event) => setForm((current) => ({ ...current, primary_color: event.target.value }))} className="w-32" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Color secundario</Label>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: form.secondary_color }} />
                    <Input value={form.secondary_color} onChange={(event) => setForm((current) => ({ ...current, secondary_color: event.target.value }))} className="w-32" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Colores predefinidos</Label>
                  <div className="flex flex-wrap gap-2">
                    {colorPresets.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className="h-8 w-8 rounded-lg"
                        style={{ backgroundColor: color.value }}
                        onClick={() => setForm((current) => ({ ...current, primary_color: color.value }))}
                      />
                    ))}
                  </div>
                </div>
                <ToggleRow label="Habilitar modo oscuro" description="Los clientes podran elegir el tema" checked={form.dark_mode_enabled} onCheckedChange={(value) => setForm((current) => ({ ...current, dark_mode_enabled: value }))} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="layout" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Estilo del Menu</CardTitle>
                <CardDescription>Elige como mostrar tus productos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SelectField label="Vista de productos" value={form.menu_layout} onChange={(value) => setForm((current) => ({ ...current, menu_layout: value }))} options={[{ value: "cards", label: "Tarjetas con imagen" }, { value: "list", label: "Lista compacta" }, { value: "grid", label: "Cuadricula" }]} />
                <SelectField label="Tamano de imagenes" value={form.image_size} onChange={(value) => setForm((current) => ({ ...current, image_size: value }))} options={[{ value: "small", label: "Pequenas" }, { value: "medium", label: "Medianas" }, { value: "large", label: "Grandes" }]} />
                <ToggleRow label="Mostrar precios" checked={form.show_prices} onCheckedChange={(value) => setForm((current) => ({ ...current, show_prices: value }))} />
                <ToggleRow label="Mostrar descripciones" checked={form.show_descriptions} onCheckedChange={(value) => setForm((current) => ({ ...current, show_descriptions: value }))} />
                <ToggleRow label="Mostrar etiquetas" checked={form.show_tags} onCheckedChange={(value) => setForm((current) => ({ ...current, show_tags: value }))} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Navegacion</CardTitle>
                <CardDescription>Configura la forma de navegar por el menu.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SelectField label="Estilo de categorias" value={form.category_navigation} onChange={(value) => setForm((current) => ({ ...current, category_navigation: value }))} options={[{ value: "tabs", label: "Pestanas horizontales" }, { value: "sidebar", label: "Barra lateral" }, { value: "dropdown", label: "Menu desplegable" }]} />
                <SelectField label="Posicion del carrito" value={form.cart_position} onChange={(value) => setForm((current) => ({ ...current, cart_position: value }))} options={[{ value: "sidebar", label: "Barra lateral" }, { value: "bottom", label: "Barra inferior" }, { value: "floating", label: "Boton flotante" }]} />
                <ToggleRow label="Busqueda de productos" checked={form.search_enabled} onCheckedChange={(value) => setForm((current) => ({ ...current, search_enabled: value }))} />
                <ToggleRow label="Filtros" checked={form.filters_enabled} onCheckedChange={(value) => setForm((current) => ({ ...current, filters_enabled: value }))} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informacion del Restaurante</CardTitle>
              <CardDescription>Esta informacion se muestra en tu tienda publica.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre del restaurante" value={form.restaurant_name} onChange={(value) => setForm((current) => ({ ...current, restaurant_name: value }))} />
                <Field label="Slogan" value={form.slogan} onChange={(value) => setForm((current) => ({ ...current, slogan: value }))} />
              </div>
              <AreaField label="Descripcion" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} rows={3} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefono" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
                <Field label="Correo" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
              </div>
              <Field label="Direccion" value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} />
              <AreaField label="Mensaje de bienvenida" value={form.welcome_message} onChange={(value) => setForm((current) => ({ ...current, welcome_message: value }))} rows={2} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Redes Sociales</CardTitle>
              <CardDescription>Enlaces visibles en la tienda publica.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Instagram" value={form.instagram_url} onChange={(value) => setForm((current) => ({ ...current, instagram_url: value }))} />
              <Field label="Facebook" value={form.facebook_url} onChange={(value) => setForm((current) => ({ ...current, facebook_url: value }))} />
              <Field label="TikTok" value={form.tiktok_url} onChange={(value) => setForm((current) => ({ ...current, tiktok_url: value }))} />
              <Field label="WhatsApp" value={form.whatsapp_number} onChange={(value) => setForm((current) => ({ ...current, whatsapp_number: value }))} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function AreaField({ label, value, onChange, rows = 3 }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value || ""} onChange={(event) => onChange(event.target.value)} rows={rows} />
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(val) => onChange(val)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ToggleRow({ label, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function ImageUploadField({ label, previewUrl, helperText, inputRef, onFileSelect, onRemove, wide = false }) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) {
            return
          }
          onFileSelect(file)
          event.target.value = ""
        }}
      />
      <button
        type="button"
        className={`border-border bg-muted/30 hover:bg-muted relative flex items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors ${isDragging ? "border-primary bg-primary/5" : ""} ${wide ? "h-32 w-full" : "h-24 w-24"}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          const file = event.dataTransfer.files?.[0]
          if (file) {
            onFileSelect(file)
          }
        }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="text-muted-foreground text-center text-sm">
            <Upload className="mx-auto mb-2 h-5 w-5" />
            <span>Subir imagen</span>
          </div>
        )}
      </button>
      {previewUrl ? <Button type="button" variant="ghost" size="sm" onClick={onRemove}>Quitar imagen</Button> : null}
      <p className="text-xs text-muted-foreground">{helperText}</p>
    </div>
  )
}
