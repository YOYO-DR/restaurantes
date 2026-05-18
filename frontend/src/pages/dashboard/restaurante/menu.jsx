import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useOperatorPermission } from "@/hooks/use-operator-permission"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { OwnerMenuSkeleton } from "@/components/ui/app-skeletons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { InfoHint } from "@/components/ui/info-hint"
import { useOwnerRestaurantMenu } from "@/hooks/use-restaurants"
import { formatCurrency } from "@/lib/format"
import { getOwnerMenuCategories } from "@/services/restaurants"
import { Check, Eye, EyeOff, ImagePlus, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react"

const ALL_CATEGORIES_VALUE = "__all__"

const categorySchema = z.object({
  name: z.string().min(2, "Ingresa un nombre valido"),
  description: z.string().optional(),
})

const itemSchema = z.object({
  menu_category: z.string().min(1, "Selecciona una categoria"),
  name: z.string().min(2, "Ingresa un nombre valido"),
  description: z.string().optional(),
  price_amount: z.coerce.number().positive("Ingresa un precio valido"),
  prep_time_minutes: z.coerce.number().int().min(0, "Tiempo invalido").optional(),
  is_available: z.boolean().default(true),
  is_popular: z.boolean().default(false),
  earns_points: z.boolean().default(false),
  allows_points_redemption: z.boolean().default(false),
  min_points_redeemable: z.coerce.number().int().min(0).optional(),
  max_points_redeemable: z.coerce.number().int().min(1).optional(),
})

function CategoryDialog({ open, onOpenChange, onSubmit, initialValues, isSubmitting }) {
  const form = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: initialValues,
  })

  useEffect(() => {
    if (open) {
      form.reset(initialValues)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialValues.id ? "Editar categoria" : "Nueva categoria"}</DialogTitle>
          <DialogDescription>Organiza tu menu con categorias claras para tus clientes.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) =>
              onSubmit({
                ...values,
                description: values.description || "",
              }))}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripcion</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="sticky bottom-0 border-t bg-background pt-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar categoria"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ItemDialog({
  open,
  onOpenChange,
  onSubmit,
  initialValues,
  categories,
  restaurantId,
  restaurantCurrencyCode,
  onCreateCategory,
  isSubmitting,
}) {
  const form = useForm({
    resolver: zodResolver(itemSchema),
    defaultValues: initialValues,
  })
  const [categoryOptions, setCategoryOptions] = useState([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [primaryImageFile, setPrimaryImageFile] = useState(null)
  const [primaryImagePreview, setPrimaryImagePreview] = useState("")
  const [initialPrimaryImage, setInitialPrimaryImage] = useState({ id: null, url: "" })
  const [removePrimaryImage, setRemovePrimaryImage] = useState(false)
  const [galleryImageFiles, setGalleryImageFiles] = useState([])
  const [galleryImagePreviews, setGalleryImagePreviews] = useState([])
  const [removedGalleryImageIds, setRemovedGalleryImageIds] = useState([])
  const primaryImageInputRef = useRef(null)
  const galleryImageInputRef = useRef(null)

  const clearSelectedPrimaryImage = useCallback(() => {
    if (!primaryImagePreview) {
      return
    }

    if (primaryImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(primaryImagePreview)
      setPrimaryImageFile(null)

      if (initialPrimaryImage.url) {
        setPrimaryImagePreview(initialPrimaryImage.url)
        setRemovePrimaryImage(false)
      } else {
        setPrimaryImagePreview("")
        setRemovePrimaryImage(true)
      }
    } else {
      setPrimaryImageFile(null)
      setPrimaryImagePreview("")
      setRemovePrimaryImage(Boolean(initialPrimaryImage.id))
    }

    if (primaryImageInputRef.current) {
      primaryImageInputRef.current.value = ""
    }
  }, [initialPrimaryImage.id, initialPrimaryImage.url, primaryImagePreview])

  const loadCategoryOptions = useCallback(async (search = "") => {
    setIsLoadingCategories(true)
    try {
      const payload = await getOwnerMenuCategories({
        restaurantId,
        search,
        limit: search ? undefined : 5,
      })

      setCategoryOptions(
        payload.map((category) => ({
          value: category.id,
          label: category.name,
        })),
      )

      return payload
    } finally {
      setIsLoadingCategories(false)
    }
  }, [restaurantId])

  useEffect(() => {
    if (!open || !restaurantId) {
      return
    }

    let isMounted = true

    loadCategoryOptions().catch(() => {
      if (isMounted) {
        setCategoryOptions([])
      }
    })
    const initialImages = initialValues.images || []
    const existingPrimaryImage =
      initialImages.find((image) => image.is_primary) ||
      initialImages.find((image) => image.url === initialValues.image_url) ||
      null

    form.reset(initialValues)
    setPrimaryImageFile(null)
    setInitialPrimaryImage({
      id: existingPrimaryImage?.id || null,
      url: existingPrimaryImage?.url || initialValues.image_url || "",
    })
    setPrimaryImagePreview(existingPrimaryImage?.url || initialValues.image_url || "")
    setRemovePrimaryImage(false)
    setGalleryImageFiles([])
    setRemovedGalleryImageIds([])
    setGalleryImagePreviews(
      initialImages
        .filter((image) => !image.is_primary)
        .map((image) => ({ id: image.id, url: image.url, isExisting: true })),
    )

    return () => {
      isMounted = false
    }
  }, [
    form,
    initialValues.image_url,
    initialValues.images,
    initialValues.menu_category,
    loadCategoryOptions,
    open,
    restaurantId,
  ])

  useEffect(() => {
    return () => {
      if (primaryImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(primaryImagePreview)
      }

      galleryImagePreviews.forEach((preview) => {
        if (preview.url.startsWith("blob:")) {
          URL.revokeObjectURL(preview.url)
        }
      })
    }
  }, [galleryImagePreviews, primaryImagePreview])

  const selectedCategoryLabel =
    categories.find((category) => String(category.id) === String(form.watch("menu_category")))?.name ||
    "Categoria seleccionada"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border bg-background px-6 py-4">
          <DialogTitle>{initialValues.id ? "Editar plato" : "Nuevo plato"}</DialogTitle>
          <DialogDescription>Administra nombre, precio y disponibilidad de tus platos.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={form.handleSubmit((values) =>
              onSubmit({
                ...values,
                description: values.description || "",
                primary_image: primaryImageFile,
                gallery_images: galleryImageFiles.map((image) => image.file),
                remove_primary_image: removePrimaryImage || undefined,
                remove_gallery_image_ids: removedGalleryImageIds,
              }))}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60 [&::-webkit-scrollbar-thumb:hover]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
              <div className="space-y-4">
            <FormField
              control={form.control}
              name="menu_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={categoryOptions}
                      value={field.value}
                      placeholder="Selecciona una categoria"
                      selectedFallbackLabel={selectedCategoryLabel}
                      isLoading={isLoadingCategories}
                      onChange={field.onChange}
                      onSearchChange={async (search) => {
                        await loadCategoryOptions(search)
                      }}
                      onCreate={async (name) => {
                        const category = await onCreateCategory(name)
                        const nextOption = {
                          value: category.id,
                          label: category.name,
                        }
                        setCategoryOptions((currentOptions) => {
                          const alreadyExists = currentOptions.some(
                            (option) => String(option.value) === String(nextOption.value),
                          )
                          return alreadyExists ? currentOptions : [nextOption, ...currentOptions]
                        })
                        field.onChange(category.id)
                        toast.success(`Categoria ${category.name} creada`)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripcion</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-4">
              <div className="space-y-2">
                <FormLabel>Foto principal</FormLabel>
                <input
                  ref={primaryImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) {
                      return
                    }

                    if (primaryImagePreview?.startsWith("blob:")) {
                      URL.revokeObjectURL(primaryImagePreview)
                    }

                    setPrimaryImageFile(file)
                    setPrimaryImagePreview(URL.createObjectURL(file))
                    setRemovePrimaryImage(false)
                    event.target.value = ""
                  }}
                />
                <div className="group relative h-32 w-32">
                  <button
                    type="button"
                    className="border-border bg-muted/30 hover:bg-muted relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-dashed transition-colors"
                    onClick={() => primaryImageInputRef.current?.click()}
                  >
                    {primaryImagePreview ? (
                      <img src={primaryImagePreview} alt="Vista previa principal" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
                        <ImagePlus className="h-5 w-5" />
                        <span>Agregar foto</span>
                      </div>
                    )}
                  </button>
                  {primaryImagePreview ? (
                    <button
                      type="button"
                      className="bg-background/90 text-foreground absolute right-2 top-2 z-10 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={clearSelectedPrimaryImage}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <FormLabel>Fotos adicionales</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={() => galleryImageInputRef.current?.click()}>
                    <Plus className="h-4 w-4" />
                    Agregar fotos
                  </Button>
                </div>
                <input
                  ref={galleryImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || [])
                    if (files.length === 0) {
                      return
                    }

                    const nextFiles = files.map((file, index) => ({
                      id: `${file.name}-${file.size}-${Date.now()}-${index}`,
                      file,
                    }))
                    setGalleryImageFiles((currentFiles) => [...currentFiles, ...nextFiles])
                    setGalleryImagePreviews((currentPreviews) => [
                      ...currentPreviews,
                      ...nextFiles.map((entry) => ({
                        id: entry.id,
                        url: URL.createObjectURL(entry.file),
                        isExisting: false,
                      })),
                    ])
                    event.target.value = ""
                  }}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {galleryImagePreviews.map((imagePreview) => (
                    <div key={imagePreview.id} className="group relative h-24 overflow-hidden rounded-xl border border-border bg-muted/30">
                      <img src={imagePreview.url} alt="Vista previa" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="bg-background/90 text-foreground absolute right-2 top-2 z-10 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => {
                          setGalleryImagePreviews((currentPreviews) => {
                            const removedPreview = currentPreviews.find((preview) => preview.id === imagePreview.id)
                            const nextPreviews = currentPreviews.filter((preview) => preview.id !== imagePreview.id)
                            if (removedPreview?.url?.startsWith("blob:")) {
                              URL.revokeObjectURL(removedPreview.url)
                            }
                            return nextPreviews
                          })

                          if (imagePreview.isExisting) {
                            setRemovedGalleryImageIds((currentIds) => {
                              const imageId = String(imagePreview.id)
                              return currentIds.includes(imageId) ? currentIds : [...currentIds, imageId]
                            })
                            return
                          }

                          setGalleryImageFiles((currentFiles) =>
                            currentFiles.filter((file) => file.id !== imagePreview.id),
                          )
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="border-border bg-muted/20 text-muted-foreground hover:bg-muted flex h-24 items-center justify-center rounded-xl border border-dashed transition-colors"
                    onClick={() => galleryImageInputRef.current?.click()}
                  >
                    <ImagePlus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="price_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <FormLabel>Moneda</FormLabel>
                <div className="bg-muted text-muted-foreground flex h-9 items-center rounded-md border px-3 text-sm font-medium uppercase">
                  {restaurantCurrencyCode || "COP"}
                </div>
              </div>
              <FormField
                control={form.control}
                name="prep_time_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prep. min</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Puntos</p>
              <FormField
                control={form.control}
                name="earns_points"
                render={({ field }) => (
                  <FormItem className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FormLabel className="m-0">Este producto otorga puntos al comprarlo</FormLabel>
                          <InfoHint>
                            Si esta apagado, los clientes no ganan puntos por el precio de este producto.
                          </InfoHint>
                        </div>
                        <p className="text-xs text-muted-foreground">Controla si este plato acumula puntos.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="allows_points_redemption"
                render={({ field }) => (
                  <FormItem className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FormLabel className="m-0">Este producto se puede pagar con puntos</FormLabel>
                          <InfoHint>
                            Permite que el cliente aplique parte de sus puntos como descuento en este producto.
                          </InfoHint>
                        </div>
                        <p className="text-xs text-muted-foreground">Activa minimos y maximos de canje por producto.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="min_points_redeemable"
                  render={({ field }) => (
                    <FormItem>
                          <FormLabel>Min puntos canjeables</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              disabled={!form.watch("allows_points_redemption")}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                />
                <FormField
                  control={form.control}
                  name="max_points_redeemable"
                  render={({ field }) => (
                    <FormItem>
                          <FormLabel>Max puntos canjeables</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              disabled={!form.watch("allows_points_redemption")}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                />
              </div>
            </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar plato"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function OwnerMenuPage() {
  const { canCreate: canCreate, canEdit, canDelete } = useOperatorPermission("menu")
  const {
    data,
    isLoading,
    error,
    toggleAvailability,
    createCategory,
    updateCategory,
    deleteCategory,
    createItem,
    updateItem,
    deleteItem,
  } = useOwnerRestaurantMenu()
  const [searchQuery, setSearchQuery] = useState("")
  const [categorySearchQuery, setCategorySearchQuery] = useState("")
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [activeCategoryIds, setActiveCategoryIds] = useState([ALL_CATEGORIES_VALUE])

  const filteredItems = useMemo(() => {
    const flattened = data.categories.flatMap((category) =>
      category.items.map((item) => ({
        ...item,
        category: category.name,
        category_id: category.id,
      })),
    )

    return flattened.filter(
      (item) => {
        const matchesSearch =
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory =
          activeCategoryIds.includes(ALL_CATEGORIES_VALUE) ||
          activeCategoryIds.includes(String(item.category_id))

        return matchesSearch && matchesCategory
      },
    )
  }, [activeCategoryIds, data.categories, searchQuery])

  const categoryInitialValues = selectedCategory || {
    name: "",
    description: "",
  }

  const visibleCategories = useMemo(
    () =>
      data.categories.filter((category) =>
        category.name.toLowerCase().includes(categorySearchQuery.toLowerCase()),
      ),
    [categorySearchQuery, data.categories],
  )

  const itemInitialValues = selectedItem || {
    menu_category: data.categories[0]?.id || "",
    name: "",
    description: "",
    price_amount: "",
    prep_time_minutes: "",
    is_available: true,
    is_popular: false,
    earns_points: false,
    allows_points_redemption: false,
    min_points_redeemable: 0,
    max_points_redeemable: "",
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">Menu</h2>
          <p className="text-muted-foreground">
            Gestiona los platos y categorias de {data.restaurant?.name || "tu restaurante"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {canCreate ? (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setSelectedCategory(null)
                setCategoryDialogOpen(true)
              }}
              disabled={!data.restaurant}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva categoria
            </Button>
          ) : null}
          {canCreate ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setSelectedItem(null)
                setItemDialogOpen(true)
              }}
              disabled={!data.restaurant || data.categories.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo plato
            </Button>
          ) : null}
        </div>
      </div>

      {isLoading ? <OwnerMenuSkeleton /> : <div className="grid min-w-0 gap-6 lg:grid-cols-4">
        <Card className="min-w-0 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Categorias</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar categorias..."
                className="pl-10"
                value={categorySearchQuery}
                onChange={(event) => setCategorySearchQuery(event.target.value)}
              />
            </div>
            <div className="rounded-lg border border-border p-3 transition-colors hover:bg-muted">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                      activeCategoryIds.includes(ALL_CATEGORIES_VALUE)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-transparent"
                    }`}
                    onClick={() => setActiveCategoryIds([ALL_CATEGORIES_VALUE])}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <span className="truncate font-medium">Todas</span>
                </div>
                <Badge variant="secondary">{data.categories.reduce((total, category) => total + category.item_count, 0)}</Badge>
              </div>
            </div>
            {visibleCategories.map((category) => (
              <div key={category.id} className="rounded-lg border border-border p-3 transition-colors hover:bg-muted">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                        activeCategoryIds.includes(String(category.id))
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-transparent"
                      }`}
                      onClick={() => {
                        setActiveCategoryIds((currentIds) => {
                          const categoryId = String(category.id)
                          if (currentIds.includes(ALL_CATEGORIES_VALUE)) {
                            return [categoryId]
                          }

                          if (currentIds.includes(categoryId)) {
                            const nextIds = currentIds.filter((id) => id !== categoryId)
                            return nextIds.length > 0 ? nextIds : [ALL_CATEGORIES_VALUE]
                          }

                          return [...currentIds, categoryId]
                        })
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <span className="truncate font-medium">{category.name}</span>
                  </div>
                  <Badge variant="secondary">{category.item_count}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => {
                        setSelectedCategory(category)
                        setCategoryDialogOpen(true)
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  ) : null}
                  {canDelete ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar categoria</AlertDialogTitle>
                        <AlertDialogDescription>
                          Vas a eliminar la categoria {category.name}. Esta accion no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={async () => {
                            try {
                              await deleteCategory(category.id)
                              toast.success(`Categoria ${category.name} eliminada`)
                            } catch (deleteError) {
                              toast.error(deleteError.message || "No fue posible eliminar la categoria")
                            }
                          }}
                        >
                          Eliminar categoria
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6 lg:col-span-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar platos..."
                className="pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <div className="space-y-4">
            {filteredItems.map((item) => (
              <Card key={item.id} className={`min-w-0 ${!item.is_available ? "opacity-60" : ""}`}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                    <div
                      className="h-16 w-16 shrink-0 rounded-lg bg-muted bg-cover bg-center"
                      style={item.image_url ? { backgroundImage: `url(${item.image_url})` } : undefined}
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-medium">{item.name}</h3>
                        {item.is_popular ? <Badge variant="secondary">Popular</Badge> : null}
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground sm:line-clamp-1">{item.description}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{item.category}</Badge>
                        <span className="font-semibold text-primary">
                          {formatCurrency(item.price_amount, item.currency_code)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                      {item.is_available ? (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Switch
                        checked={item.is_available}
                        onCheckedChange={async (checked) => {
                          try {
                            await toggleAvailability(item.id, checked)
                            toast.success(`Disponibilidad de ${item.name} actualizada`)
                          } catch (toggleError) {
                            toast.error(toggleError.message || "No fue posible actualizar la disponibilidad")
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedItem({
                              ...item,
                              menu_category: data.categories.find((category) => category.name === item.category)?.id || "",
                              earns_points: Boolean(item.earns_points),
                              allows_points_redemption: Boolean(item.allows_points_redemption),
                              min_points_redeemable: item.min_points_redeemable ?? 0,
                              max_points_redeemable: item.max_points_redeemable ?? "",
                            })
                            setItemDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={async () => {
                            try {
                              await deleteItem(item.id)
                              toast.success(`Plato ${item.name} eliminado`)
                            } catch (deleteError) {
                              toast.error(deleteError.message || "No fue posible eliminar el plato")
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>}

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        initialValues={categoryInitialValues}
        isSubmitting={isSavingCategory}
        onSubmit={async (values) => {
          try {
            setIsSavingCategory(true)
            const payload = {
              ...values,
              description: values.description || "",
              slug: buildSlug(values.name),
              sort_order: selectedCategory?.sort_order ?? 0,
              is_active: selectedCategory?.is_active ?? true,
            }
            if (selectedCategory?.id) {
              await updateCategory(selectedCategory.id, payload)
              toast.success("Categoria actualizada")
            } else {
              await createCategory({
                ...payload,
                restaurant: data.restaurant.id,
              })
              toast.success("Categoria creada")
            }
            setCategoryDialogOpen(false)
          } catch (saveError) {
            toast.error(saveError.message || "No fue posible guardar la categoria")
          } finally {
            setIsSavingCategory(false)
          }
        }}
      />

      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        initialValues={itemInitialValues}
        categories={data.categories}
        restaurantId={data.restaurant?.id}
        restaurantCurrencyCode={data.restaurant?.currency_code}
        onCreateCategory={async (name) => {
          const payload = {
            restaurant: data.restaurant.id,
            name,
            description: "",
            slug: buildSlug(name),
            sort_order: 0,
            is_active: true,
          }
          const category = await createCategory(payload)
          return category
        }}
        isSubmitting={isSavingItem}
        onSubmit={async (values) => {
          try {
            setIsSavingItem(true)
            const payload = {
              ...values,
              restaurant: data.restaurant.id,
              prep_time_minutes: values.prep_time_minutes || null,
              max_points_redeemable: values.max_points_redeemable || null,
              price_amount: String(values.price_amount),
            }
            if (selectedItem?.id) {
              await updateItem(selectedItem.id, payload)
              toast.success("Plato actualizado")
            } else {
              await createItem(payload)
              toast.success("Plato creado")
            }
            setItemDialogOpen(false)
          } catch (saveError) {
            toast.error(saveError.message || "No fue posible guardar el plato")
          } finally {
            setIsSavingItem(false)
          }
        }}
      />
    </div>
  )
}

function buildSlug(value) {
  return (
    value
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "categoria"
  )
}
