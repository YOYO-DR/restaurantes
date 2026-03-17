import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Mail, Smartphone, Shield, Eye, EyeOff, CreditCard, Trash2, LogOut } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
export default function ClienteConfiguracionPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [notifications, setNotifications] = useState({
        email: true,
        push: true,
        sms: false,
        promotions: true,
        orderUpdates: true,
        newsletter: false
    });
    return (<div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
        <p className="text-muted-foreground">
          Administra las preferencias de tu cuenta
        </p>
      </div>

      <div className="grid gap-6">
        {/* Notificaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5"/>
              Notificaciones
            </CardTitle>
            <CardDescription>
              Configura como quieres recibir notificaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Canales de notificacion</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground"/>
                    <div>
                      <p className="text-sm font-medium">Correo electronico</p>
                      <p className="text-xs text-muted-foreground">Recibe notificaciones por email</p>
                    </div>
                  </div>
                  <Switch checked={notifications.email} onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: Boolean(checked) }))}/>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-4 w-4 text-muted-foreground"/>
                    <div>
                      <p className="text-sm font-medium">Notificaciones push</p>
                      <p className="text-xs text-muted-foreground">Notificaciones en tu dispositivo</p>
                    </div>
                  </div>
                  <Switch checked={notifications.push} onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, push: Boolean(checked) }))}/>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-4 w-4 text-muted-foreground"/>
                    <div>
                      <p className="text-sm font-medium">SMS</p>
                      <p className="text-xs text-muted-foreground">Mensajes de texto a tu celular</p>
                    </div>
                  </div>
                  <Switch checked={notifications.sms} onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, sms: Boolean(checked) }))}/>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Tipos de notificacion</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Actualizaciones de pedidos</p>
                    <p className="text-xs text-muted-foreground">Estado de preparacion y envio</p>
                  </div>
                  <Switch checked={notifications.orderUpdates} onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, orderUpdates: Boolean(checked) }))}/>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Promociones y ofertas</p>
                    <p className="text-xs text-muted-foreground">Descuentos exclusivos y cupones</p>
                  </div>
                  <Switch checked={notifications.promotions} onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, promotions: Boolean(checked) }))}/>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Newsletter</p>
                    <p className="text-xs text-muted-foreground">Novedades y restaurantes nuevos</p>
                  </div>
                  <Switch checked={notifications.newsletter} onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, newsletter: Boolean(checked) }))}/>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seguridad */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5"/>
              Seguridad
            </CardTitle>
            <CardDescription>
              Protege tu cuenta con una contrasena segura
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="current-password">Contrasena actual</Label>
                <div className="relative">
                  <Input id="current-password" type={showPassword ? "text" : "password"} placeholder="********"/>
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva contrasena</Label>
                <Input id="new-password" type="password" placeholder="********"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar contrasena</Label>
                <Input id="confirm-password" type="password" placeholder="********"/>
              </div>
            </div>
            <Button>Actualizar contrasena</Button>
          </CardContent>
        </Card>

        {/* Metodos de pago */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5"/>
              Metodos de pago
            </CardTitle>
            <CardDescription>
              Administra tus tarjetas y metodos de pago guardados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-14 items-center justify-center rounded bg-muted text-xs font-bold">
                    VISA
                  </div>
                  <div>
                    <p className="font-medium">**** **** **** 4532</p>
                    <p className="text-xs text-muted-foreground">Vence 12/26</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4"/>
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-14 items-center justify-center rounded bg-muted text-xs font-bold">
                    MC
                  </div>
                  <div>
                    <p className="font-medium">**** **** **** 8721</p>
                    <p className="text-xs text-muted-foreground">Vence 08/25</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4"/>
                </Button>
              </div>
            </div>
            <Button variant="outline">Agregar metodo de pago</Button>
          </CardContent>
        </Card>

        {/* Zona de peligro */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de peligro</CardTitle>
            <CardDescription>
              Acciones irreversibles para tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Cerrar sesion en todos los dispositivos</p>
                <p className="text-sm text-muted-foreground">
                  Cierra sesion en todos los dispositivos donde hayas iniciado sesion
                </p>
              </div>
              <Button variant="outline" className="shrink-0">
                <LogOut className="mr-2 h-4 w-4"/>
                Cerrar sesiones
              </Button>
            </div>

            <Separator />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-destructive">Eliminar cuenta</p>
                <p className="text-sm text-muted-foreground">
                  Esta accion es permanente y no se puede deshacer
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="shrink-0">
                    <Trash2 className="mr-2 h-4 w-4"/>
                    Eliminar cuenta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta accion no se puede deshacer. Se eliminaran permanentemente tu cuenta 
                      y todos los datos asociados, incluyendo historial de pedidos y puntos de lealtad.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Eliminar cuenta
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>);
}
