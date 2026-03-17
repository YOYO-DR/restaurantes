import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, } from 'recharts';
import { Users, Store, ShoppingCart, DollarSign, AlertCircle, } from 'lucide-react';
const revenueData = [
    { month: 'Ene', revenue: 45000, orders: 240 },
    { month: 'Feb', revenue: 52000, orders: 280 },
    { month: 'Mar', revenue: 48000, orders: 250 },
    { month: 'Abr', revenue: 61000, orders: 320 },
    { month: 'May', revenue: 55000, orders: 290 },
    { month: 'Jun', revenue: 67000, orders: 350 },
];
const categoryData = [
    { name: 'Pizzería', value: 25, fill: '#dc2626' },
    { name: 'Hamburguesas', value: 20, fill: '#f59e0b' },
    { name: 'Sushi', value: 18, fill: '#3b82f6' },
    { name: 'Comida Criolla', value: 22, fill: '#10b981' },
    { name: 'Postres', value: 15, fill: '#ec4899' },
];
export default function AdminDashboard() {
    return (<div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-foreground">
            Panel de Administración
          </h1>
          <p className="text-muted-foreground mt-2">
            Bienvenido, Admin. Aquí está el resumen de tu plataforma.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Descargar Reporte</Button>
          <Button>Nuevo Restaurante</Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Usuarios
              </p>
              <p className="text-3xl font-bold text-foreground mt-2">
                12,540
              </p>
              <p className="text-xs text-green-600 mt-2">
                +12% este mes
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600"/>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Restaurantes Activos
              </p>
              <p className="text-3xl font-bold text-foreground mt-2">
                456
              </p>
              <p className="text-xs text-green-600 mt-2">
                +8% este mes
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Store className="w-6 h-6 text-orange-600"/>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Órdenes
              </p>
              <p className="text-3xl font-bold text-foreground mt-2">
                34,821
              </p>
              <p className="text-xs text-green-600 mt-2">
                +23% este mes
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-emerald-600"/>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Ingresos Totales
              </p>
              <p className="text-3xl font-bold text-foreground mt-2">
                $328,000
              </p>
              <p className="text-xs text-green-600 mt-2">
                +18% este mes
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600"/>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Orders Chart */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">
            Ingresos y Órdenes - Últimos 6 Meses
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
              <XAxis dataKey="month" stroke="#6b7280"/>
              <YAxis stroke="#6b7280"/>
              <Tooltip contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
        }}/>
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#dc2626" name="Ingresos ($)" strokeWidth={2}/>
              <Line type="monotone" dataKey="orders" stroke="#3b82f6" name="Órdenes" strokeWidth={2}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Distribution by Category */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">
            Distribución por Categoría
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value">
                {categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill}/>))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Alerts & Issues */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-orange-600"/>
          <h3 className="text-lg font-semibold text-foreground">
            Alertas y Avisos
          </h3>
        </div>
        <div className="space-y-3">
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm font-medium text-orange-900">
              3 restaurantes con órdenes pendientes por más de 2 horas
            </p>
            <p className="text-xs text-orange-700 mt-1">
              Se recomienda contactar con los administradores
            </p>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-900">
              1 usuario reportado por comportamiento inapropiado
            </p>
            <p className="text-xs text-red-700 mt-1">
              Requiere revisión inmediata
            </p>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900">
              Actualización de sistema disponible
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Se recomienda actualizar en las próximas 48 horas
            </p>
          </div>
        </div>
      </Card>
    </div>);
}
