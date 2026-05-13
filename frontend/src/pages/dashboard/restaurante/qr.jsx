import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useOwnerRestaurantQrs } from "@/hooks/use-restaurants"
import { Copy, Download, ExternalLink, Loader2, Pencil, Plus, Printer, QrCode, Trash2 } from "lucide-react"

const QR_SIZES = {
  small: 200,
  medium: 400,
  large: 800,
  xlarge: 1200,
}

let qrCodeModulePromise
let jsZipModulePromise
let jsPdfModulePromise

function loadQrCodeModule() {
  if (!qrCodeModulePromise) {
    qrCodeModulePromise = import("qrcode")
  }

  return qrCodeModulePromise
}

function loadJsZipModule() {
  if (!jsZipModulePromise) {
    jsZipModulePromise = import("jszip")
  }

  return jsZipModulePromise
}

function loadJsPdfModule() {
  if (!jsPdfModulePromise) {
    jsPdfModulePromise = import("jspdf")
  }

  return jsPdfModulePromise
}

function TableDialog({ open, onOpenChange, initialValues, isSaving, onSubmit }) {
  const [form, setForm] = useState(initialValues)

  useEffect(() => {
    if (open) {
      setForm(initialValues)
    }
  }, [initialValues, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialValues.id ? "Editar mesa" : "Agregar mesa"}</DialogTitle>
          <DialogDescription>Configura la mesa y genera su QR unico para pedidos en mesa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Numero de mesa" value={form.table_number} onChange={(value) => setForm((current) => ({ ...current, table_number: value }))} />
          <Field label="Capacidad" type="number" value={form.capacity} onChange={(value) => setForm((current) => ({ ...current, capacity: value }))} />
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={form.status_code} onValueChange={(value) => setForm((current) => ({ ...current, status_code: value }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activa</SelectItem>
                <SelectItem value="inactive">Inactiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={isSaving} onClick={() => onSubmit({ ...form, capacity: Number(form.capacity) || 0 })}>
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar mesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function QrPreview({ value, size = 400, color = "#111827" }) {
  const [dataUrl, setDataUrl] = useState("")

  useEffect(() => {
    let isMounted = true

    if (!value) {
      setDataUrl("")
      return
    }

    loadQrCodeModule().then(({ default: QRCode }) =>
      QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: color,
        light: "#FFFFFF",
      },
      }),
    ).then((nextDataUrl) => {
      if (isMounted) {
        setDataUrl(nextDataUrl)
      }
    })

    return () => {
      isMounted = false
    }
  }, [color, size, value])

  return dataUrl ? (
    <img src={dataUrl} alt="Codigo QR" className="h-full w-full rounded-lg object-contain" />
  ) : (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
      <QrCode className="h-16 w-16 text-foreground" />
    </div>
  )
}

export default function QRRestaurantePage() {
  const { data, isLoading, isRefreshing, error, createTable, updateTable, deleteTable } = useOwnerRestaurantQrs()
  const [tableDialogOpen, setTableDialogOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState(null)
  const [isSavingTable, setIsSavingTable] = useState(false)
  const [activeTab, setActiveTab] = useState("menu")
  const [downloadSize, setDownloadSize] = useState("medium")
  const [downloadFormat, setDownloadFormat] = useState("png")
  const [qrColor, setQrColor] = useState("#111827")

  const tableInitialValues = selectedTable || {
    table_number: "",
    capacity: "",
    status_code: "active",
  }

  const menuQrUrl = data.menu_qr?.url || ""
  const selectedDownloadSize = QR_SIZES[downloadSize]
  const availableColors = ["#111827", "#0f766e", "#2563eb", "#16a34a", "#9333ea"]
  const totalActiveTables = useMemo(
    () => data.tables.filter((table) => table.status === "active").length,
    [data.tables],
  )

  if (isLoading) {
    return <DashboardShellSkeleton />
  }

  async function downloadQr(value, filename) {
    if (!value) {
      return
    }

    if (downloadFormat === "svg") {
      const { default: QRCode } = await loadQrCodeModule()
      const svg = await QRCode.toString(value, {
        type: "svg",
        width: selectedDownloadSize,
        margin: 1,
        color: { dark: qrColor, light: "#FFFFFF" },
      })
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
      triggerDownload(URL.createObjectURL(blob), `${filename}.svg`)
      return
    }

    const { default: QRCode } = await loadQrCodeModule()
    const dataUrl = await QRCode.toDataURL(value, {
      width: selectedDownloadSize,
      margin: 1,
      color: { dark: qrColor, light: "#FFFFFF" },
    })
    triggerDownload(dataUrl, `${filename}.png`)
  }

  async function printQr(value) {
    const { default: QRCode } = await loadQrCodeModule()
    const dataUrl = await QRCode.toDataURL(value, {
      width: 800,
      margin: 1,
      color: { dark: qrColor, light: "#FFFFFF" },
    })
    const printWindow = window.open("", "_blank", "width=900,height=900")
    if (!printWindow) {
      return
    }
    printWindow.document.write(`<img src="${dataUrl}" style="width:320px;height:320px;display:block;margin:40px auto;" />`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  async function downloadAllQrsZip() {
    const [{ default: QRCode }, { default: JSZip }] = await Promise.all([
      loadQrCodeModule(),
      loadJsZipModule(),
    ])
    const zip = new JSZip()

    await Promise.all(
      data.tables.map(async (table) => {
        const dataUrl = await QRCode.toDataURL(table.qr_url, {
          width: selectedDownloadSize,
          margin: 1,
          color: { dark: qrColor, light: "#FFFFFF" },
        })
        zip.file(`mesa-${table.table_number}.png`, dataUrl.split(",")[1], { base64: true })
      }),
    )

    const blob = await zip.generateAsync({ type: "blob" })
    triggerDownload(URL.createObjectURL(blob), `mesas-${data.restaurant?.slug || "restaurant"}.zip`)
  }

  async function downloadAllQrsPdf() {
    const [{ default: QRCode }, { jsPDF }] = await Promise.all([
      loadQrCodeModule(),
      loadJsPdfModule(),
    ])
    const pdf = new jsPDF({ unit: "pt", format: "a4" })

    for (const [index, table] of data.tables.entries()) {
      const dataUrl = await QRCode.toDataURL(table.qr_url, {
        width: 800,
        margin: 1,
        color: { dark: qrColor, light: "#FFFFFF" },
      })

      if (index > 0) {
        pdf.addPage()
      }

      pdf.setFontSize(18)
      pdf.text(`Mesa ${table.table_number}`, 40, 50)
      pdf.addImage(dataUrl, "PNG", 120, 100, 320, 320)
      pdf.setFontSize(10)
      pdf.text(table.qr_url, 40, 460, { maxWidth: 500 })
    }

    pdf.save(`mesas-${data.restaurant?.slug || "restaurant"}.pdf`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Codigos QR</h1>
        <p className="text-muted-foreground">Genera y administra codigos QR para tu menu y mesas</p>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="menu">QR del Menu</TabsTrigger>
          <TabsTrigger value="tables">QR por Mesa</TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Codigo QR del Menu</CardTitle>
                <CardDescription>Este codigo QR dirige a los clientes a tu menu digital</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <div className="rounded-xl border-4 border-primary/20 bg-background p-6">
                    <div className="h-48 w-48 rounded-lg bg-muted p-2">
                      <QrPreview value={menuQrUrl} color={qrColor} size={selectedDownloadSize} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>URL del menu</Label>
                  <div className="flex gap-2">
                    <Input value={menuQrUrl} readOnly className="flex-1" />
                    <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(menuQrUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href={menuQrUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button className="flex-1" onClick={() => downloadQr(menuQrUrl, `menu-${data.restaurant?.slug || "restaurant"}`)}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar {downloadFormat.toUpperCase()}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => printQr(menuQrUrl)}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Personalizar QR</CardTitle>
                <CardDescription>Ajusta el diseno de tu codigo QR</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tamano de descarga</Label>
                  <Select value={downloadSize} onValueChange={(value) => setDownloadSize(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tamano de descarga" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Pequeno (200x200)</SelectItem>
                      <SelectItem value="medium">Mediano (400x400)</SelectItem>
                      <SelectItem value="large">Grande (800x800)</SelectItem>
                      <SelectItem value="xlarge">Extra Grande (1200x1200)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Formato</Label>
                  <Select value={downloadFormat} onValueChange={(value) => setDownloadFormat(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Formato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="svg">SVG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Color del QR</Label>
                  <div className="flex gap-2">
                    {availableColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="h-10 w-10 rounded-lg"
                        style={{ backgroundColor: color, boxShadow: qrColor === color ? "0 0 0 2px hsl(var(--primary))" : "none" }}
                        onClick={() => setQrColor(color)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-4">
                  <h4 className="mb-2 font-medium">Consejos de uso</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>- Coloca el QR en cada mesa de tu restaurante.</li>
                    <li>- Imprime en material resistente al agua.</li>
                    <li>- Tamano minimo recomendado: 3cm x 3cm.</li>
                    <li>- Prueba el QR antes de imprimir.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tables" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Mesas del Restaurante</CardTitle>
                  <CardDescription>Cada mesa tiene un QR unico para pedidos en mesa</CardDescription>
                </div>
                <Button onClick={() => {
                  setSelectedTable(null)
                  setTableDialogOpen(true)
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Mesa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isRefreshing ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="animate-pulse rounded-xl border border-border p-4 space-y-4">
                      <div className="h-5 w-28 rounded bg-muted" />
                      <div className="mx-auto h-24 w-24 rounded bg-muted" />
                      <div className="h-4 w-full rounded bg-muted" />
                      <div className="h-9 w-full rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{data.tables.length} mesas</Badge>
                <Badge variant="outline">{totalActiveTables} activas</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.tables.map((table) => (
                  <Card key={table.id} className={table.status === "inactive" ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Mesa {table.table_number}</h3>
                          <p className="text-sm text-muted-foreground">{table.capacity} personas</p>
                        </div>
                        <Badge variant={table.status === "active" ? "default" : "secondary"}>{table.status_name}</Badge>
                      </div>

                      <div className="mb-4 flex justify-center">
                        <div className="rounded-lg bg-muted p-3">
                          <div className="h-20 w-20">
                            <QrPreview value={table.qr_url} color={qrColor} size={200} />
                          </div>
                        </div>
                      </div>

                      <div className="mb-4 text-xs text-muted-foreground break-all">{table.qr_url}</div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadQr(table.qr_url, `mesa-${table.table_number}`)}>
                          <Download className="mr-1 h-3 w-3" />
                          Descargar
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
                          setSelectedTable({ ...table, status_code: table.status })
                          setTableDialogOpen(true)
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={async () => {
                          try {
                            await deleteTable(table.id)
                            toast.success(`Mesa ${table.table_number} eliminada`)
                          } catch (deleteError) {
                            toast.error(deleteError.message || "No fue posible eliminar la mesa")
                          }
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Descargar Todos</CardTitle>
              <CardDescription>Genera todos los QR de mesas en un archivo listo para compartir o imprimir.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Button onClick={downloadAllQrsZip} disabled={data.tables.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Descargar ZIP (PNG)
              </Button>
              <Button variant="outline" onClick={downloadAllQrsPdf} disabled={data.tables.length === 0}>
                <Printer className="mr-2 h-4 w-4" />
                Generar PDF para Imprimir
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TableDialog
        open={tableDialogOpen}
        onOpenChange={setTableDialogOpen}
        initialValues={tableInitialValues}
        isSaving={isSavingTable}
        onSubmit={async (payload) => {
          try {
            setIsSavingTable(true)
            if (selectedTable?.id) {
              await updateTable(selectedTable.id, payload)
              toast.success("Mesa actualizada")
            } else {
              setActiveTab("tables")
              await createTable(payload)
              toast.success("Mesa creada")
            }
            setTableDialogOpen(false)
            setSelectedTable(null)
          } catch (saveError) {
            toast.error(saveError.message || "No fue posible guardar la mesa")
          } finally {
            setIsSavingTable(false)
          }
        }}
      />
    </div>
  )
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function triggerDownload(url, filename) {
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}
