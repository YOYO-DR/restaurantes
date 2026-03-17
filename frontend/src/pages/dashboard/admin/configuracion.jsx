import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings, Lock, Bell, Shield, Database, Loader2, Save, } from 'lucide-react';
export default function AdminSettings() {
    const [activeTab, setActiveTab] = useState('general');
    const [isSaving, setIsSaving] = useState(false);
    const handleSave = async () => {
        setIsSaving(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setIsSaving(false);
    };
    return (<div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold text-foreground">
          Configuración
        </h1>
        <p className="text-muted-foreground mt-2">
          Administra la configuración general de la plataforma
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {[
            { id: 'general', label: 'General', icon: Settings },
            { id: 'security', label: 'Seguridad', icon: Lock },
            { id: 'notifications', label: 'Notificaciones', icon: Bell },
            { id: 'compliance', label: 'Cumplimiento', icon: Shield },
        ].map(({ id, label, icon: Icon }) => (<button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon className="w-4 h-4"/>
            {label}
          </button>))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (<div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">
              Información de la Plataforma
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nombre de la Plataforma
                </label>
                <Input defaultValue="FoodHub" className="w-full"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email de Soporte
                </label>
                <Input type="email" defaultValue="support@foodhub.com" className="w-full"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Teléfono de Soporte
                </label>
                <Input defaultValue="+57 600 123 4567" className="w-full"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Dirección
                </label>
                <Input defaultValue="Bogotá, Colombia" className="w-full"/>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">
              Configuración de Negocio
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Comisión por Orden (%)
                </label>
                <Input type="number" defaultValue="10" className="w-full"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Costo de Envío Base ($)
                </label>
                <Input type="number" defaultValue="2.50" className="w-full"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Hora de Corte para Órdenes del Día
                </label>
                <Input type="time" defaultValue="23:59" className="w-full"/>
              </div>
            </div>
          </Card>
        </div>)}

      {/* Security Settings */}
      {activeTab === 'security' && (<div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">
              Configuración de Seguridad
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-foreground">
                    Autenticación de Dos Factores
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Requiere verificación adicional para acceso a admin
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="w-6 h-6 rounded"/>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-foreground">
                    Verificación de Identidad de Restaurantes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Requerir documentos antes de activar restaurante
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="w-6 h-6 rounded"/>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-foreground">
                    Encriptación de Datos de Pago
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Usar estándar PCI-DSS
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="w-6 h-6 rounded"/>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">
              Contraseña de Administrador
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Contraseña Actual
                </label>
                <Input type="password" className="w-full"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nueva Contraseña
                </label>
                <Input type="password" className="w-full"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirmar Nueva Contraseña
                </label>
                <Input type="password" className="w-full"/>
              </div>
            </div>
          </Card>
        </div>)}

      {/* Notifications Settings */}
      {activeTab === 'notifications' && (<Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">
            Preferencias de Notificaciones
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium text-foreground">
                  Órdenes Nuevas
                </p>
                <p className="text-sm text-muted-foreground">
                  Notificar cuando hay nuevas órdenes en restaurantes
                </p>
              </div>
              <input type="checkbox" defaultChecked className="w-6 h-6 rounded"/>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium text-foreground">
                  Problemas de Pago
                </p>
                <p className="text-sm text-muted-foreground">
                  Notificar sobre transacciones fallidas
                </p>
              </div>
              <input type="checkbox" defaultChecked className="w-6 h-6 rounded"/>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium text-foreground">
                  Reportes de Usuarios
                </p>
                <p className="text-sm text-muted-foreground">
                  Notificar sobre reportes de usuarios
                </p>
              </div>
              <input type="checkbox" defaultChecked className="w-6 h-6 rounded"/>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium text-foreground">
                  Mantenimiento del Sistema
                </p>
                <p className="text-sm text-muted-foreground">
                  Notificar sobre actualizaciones del sistema
                </p>
              </div>
              <input type="checkbox" defaultChecked className="w-6 h-6 rounded"/>
            </div>
          </div>
        </Card>)}

      {/* Compliance Settings */}
      {activeTab === 'compliance' && (<div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">
              Cumplimiento Normativo
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Política de Privacidad (URL)
                </label>
                <Input defaultValue="https://foodhub.com/privacy" className="w-full"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Términos y Condiciones (URL)
                </label>
                <Input defaultValue="https://foodhub.com/terms" className="w-full"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Política de Cookies (URL)
                </label>
                <Input defaultValue="https://foodhub.com/cookies" className="w-full"/>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">
              Datos y Base de Datos
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-foreground">
                    Última Copia de Seguridad
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Marzo 14, 2024 - 02:30 AM
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Ver
                </Button>
              </div>
              <Button variant="outline" className="w-full">
                <Database className="w-4 h-4 mr-2"/>
                Realizar Copia de Seguridad Ahora
              </Button>
            </div>
          </Card>
        </div>)}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    </div>);
}
