import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { TableSkeleton } from "@/components/ui/app-skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useOwnerOperators } from "@/hooks/use-restaurants"
import { Loader2, Mail, Plus, Shield, Trash2, UserPlus, Users, X } from "lucide-react"

const MODULES = [
  { key: "pedidos", label: "Pedidos" },
  { key: "menu", label: "Menú" },
  { key: "inventario", label: "Inventario" },
  { key: "clientes", label: "Clientes" },
  { key: "resenas", label: "Reseñas" },
  { key: "analiticas", label: "Analíticas" },
  { key: "qr", label: "Código QR" },
  { key: "personalizacion", label: "Personalización" },
  { key: "configuracion", label: "Configuración" },
]

const ACTIONS = [
  { key: "can_view", label: "Ver" },
  { key: "can_create", label: "Crear" },
  { key: "can_edit", label: "Editar" },
  { key: "can_delete", label: "Eliminar" },
]

const DEFAULT_PERMS = {
  pedidos:        { can_view: true,  can_create: false, can_edit: true,  can_delete: false },
  menu:           { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
  inventario:     { can_view: true,  can_create: false, can_edit: false, can_delete: false },
  clientes:       { can_view: true,  can_create: false, can_edit: false, can_delete: false },
  resenas:        { can_view: true,  can_create: false, can_edit: true,  can_delete: false },
  analiticas:     { can_view: true,  can_create: false, can_edit: false, can_delete: false },
  qr:             { can_view: false, can_create: false, can_edit: false, can_delete: false },
  personalizacion:{ can_view: false, can_create: false, can_edit: false, can_delete: false },
  configuracion:  { can_view: false, can_create: false, can_edit: false, can_delete: false },
}

function PermissionsMatrix({ permissions, onChange, readOnly = false }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Módulo</th>
            {ACTIONS.map((a) => (
              <th key={a.key} className="px-3 py-2 text-center font-medium text-muted-foreground">
                {a.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((mod, i) => (
            <tr key={mod.key} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              <td className="px-4 py-2 font-medium">{mod.label}</td>
              {ACTIONS.map((action) => (
                <td key={action.key} className="px-3 py-2 text-center">
                  <Checkbox
                    checked={permissions[mod.key]?.[action.key] ?? false}
                    disabled={readOnly}
                    onCheckedChange={
                      readOnly
                        ? undefined
                        : (checked) =>
                            onChange(mod.key, action.key, Boolean(checked))
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InviteDialog({ open, onOpenChange, onInvite }) {
  const [permissions, setPermissions] = useState({ ...DEFAULT_PERMS })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm({
    resolver: zodResolver(z.object({ email: z.string().email("Correo inválido") })),
    defaultValues: { email: "" },
  })

  const handlePermChange = (module, action, value) => {
    setPermissions((prev) => ({
      ...prev,
      [module]: { ...prev[module], [action]: value },
    }))
  }

  const handleSubmit = async (values) => {
    setIsSubmitting(true)
    try {
      await onInvite({ email: values.email, permissions })
      toast.success("Invitación enviada correctamente")
      onOpenChange(false)
      form.reset()
      setPermissions({ ...DEFAULT_PERMS })
    } catch (error) {
      toast.error(error.message || "No fue posible enviar la invitación")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invitar operador</DialogTitle>
          <DialogDescription>
            El operador recibirá un correo para crear su cuenta con los permisos que configures.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="operador@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">Permisos iniciales</p>
              <PermissionsMatrix permissions={permissions} onChange={handlePermChange} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar invitación
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function buildPermissionsMap(operatorPermissions) {
  const map = {}
  for (const perm of operatorPermissions || []) {
    map[perm.module] = {
      can_view: perm.can_view,
      can_create: perm.can_create,
      can_edit: perm.can_edit,
      can_delete: perm.can_delete,
    }
  }
  // Rellena módulos faltantes con los defaults
  for (const mod of MODULES) {
    if (!map[mod.key]) {
      map[mod.key] = { ...DEFAULT_PERMS[mod.key] }
    }
  }
  return map
}

function EditPermissionsDialog({ open, onOpenChange, operator, onSave }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [permissions, setPermissions] = useState(() => buildPermissionsMap(operator?.permissions))

  const handlePermChange = (module, action, value) => {
    setPermissions((prev) => ({
      ...prev,
      [module]: { ...prev[module], [action]: value },
    }))
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      await onSave(operator.id, permissions)
      toast.success("Permisos actualizados")
      onOpenChange(false)
    } catch (error) {
      toast.error(error.message || "No fue posible actualizar los permisos")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!operator) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar permisos — {operator.name}</DialogTitle>
          <DialogDescription>{operator.email}</DialogDescription>
        </DialogHeader>
        <PermissionsMatrix permissions={permissions} onChange={handlePermChange} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar permisos"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function OperadoresPage() {
  const { operators, invitations, isLoading, inviteOperator, cancelInvitation, updatePermissions, removeOperator } =
    useOwnerOperators()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  if (isLoading) return <TableSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Operadores</h2>
          <p className="text-muted-foreground">Gestiona quién tiene acceso a tu restaurante y qué puede hacer.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invitar operador
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Operadores activos</p>
              <p className="text-2xl font-bold">{operators.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
              <Mail className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invitaciones pendientes</p>
              <p className="text-2xl font-bold">{invitations.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operadores activos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {operators.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
              <Users className="h-10 w-10 opacity-30" />
              <p>Aún no tienes operadores. Invita a alguien para que te ayude a gestionar el restaurante.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operador</TableHead>
                  <TableHead className="hidden sm:table-cell">Miembro desde</TableHead>
                  <TableHead className="hidden md:table-cell">Permisos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((op) => {
                  const initials = (op.name || op.email)
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                  const activeModules = (op.permissions || [])
                    .filter((p) => p.can_view)
                    .map((p) => MODULES.find((m) => m.key === p.module)?.label)
                    .filter(Boolean)

                  return (
                    <TableRow key={op.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{op.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{op.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {op.joined_at
                          ? formatDistanceToNow(new Date(op.joined_at), { addSuffix: true, locale: es })
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {activeModules.slice(0, 3).map((label) => (
                            <Badge key={label} variant="secondary" className="text-xs">
                              {label}
                            </Badge>
                          ))}
                          {activeModules.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{activeModules.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => setEditTarget(op)}
                          >
                            <Shield className="h-4 w-4" />
                            <span className="hidden sm:inline">Permisos</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar operador</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminará el acceso de <strong>{op.name}</strong> al restaurante. Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={async () => {
                                    try {
                                      await removeOperator(op.id)
                                      toast.success(`Operador ${op.name} eliminado`)
                                    } catch (error) {
                                      toast.error(error.message || "No fue posible eliminar el operador")
                                    }
                                  }}
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invitaciones pendientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Correo</TableHead>
                  <TableHead className="hidden sm:table-cell">Expira</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true, locale: es })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          try {
                            await cancelInvitation(inv.id)
                            toast.success("Invitación cancelada")
                          } catch (error) {
                            toast.error(error.message || "No fue posible cancelar la invitación")
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={inviteOperator}
      />

      <EditPermissionsDialog
        key={editTarget?.id}
        open={Boolean(editTarget)}
        onOpenChange={(open) => { if (!open) setEditTarget(null) }}
        operator={editTarget}
        onSave={updatePermissions}
      />
    </div>
  )
}
