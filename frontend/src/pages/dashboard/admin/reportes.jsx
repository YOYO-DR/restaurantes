import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, } from 'recharts';
import { Download, Filter, Calendar } from 'lucide-react';
const ordersData = [
    { date: 'Mar 1', orders: 240, revenue: 12000 },
    { date: 'Mar 2', orders: 280, revenue: 14000 },
    { date: 'Mar 3', orders: 250, revenue: 12500 },
    { date: 'Mar 4', orders: 320, revenue: 16000 },
    { date: 'Mar 5', orders: 290, revenue: 14500 },
    { date: 'Mar 6', orders: 350, revenue: 17500 },
];
const categoryPerformance = [
    { category: 'Pizzería', orders: 1200, rating: 4.7 },
    { category: 'Hamburguesas', orders: 950, rating: 4.5 },
    { category: 'Sushi', orders: 780, rating: 4.8 },
    { category: 'Comida Criolla', orders: 890, rating: 4.3 },
    { category: 'Postres', options: 650, rating: 4.6 },
];
const deliveryMethods = [
    { method: 'Delivery', value: 6500, percentage: 55 },
    { method: 'Pickup', value: 4200, percentage: 35 },
    { method: 'Para Comer', value: 1300, percentage: 10 },
];
export default function AdminReports() {
    return (<div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-foreground">
            Reportes y Análisis
          </h1>
          <p className="text-muted-foreground mt-2">
            Análisis detallado del desempeño de la plataforma
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2"/>
            Filtros
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2"/>
            Descargar
          </Button>
        </div>
      </div>

      {/* Date Range Selection */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-2">
              Fecha de Inicio
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground"/>
              <input type="date" className="flex-1 px-4 py-2 border border-border rounded-lg bg-background" defaultValue="2024-03-01"/>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-2">
              Fecha de Fin
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground"/>
              <input type="date" className="flex-1 px-4 py-2 border border-border rounded-lg bg-background" defaultValue="2024-03-06"/>
            </div>
          </div>
          <Button className="md:mt-6">Aplicar</Button>
        </div>
      </Card>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders & Revenue Trend */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">
            Tendencia de Órdenes e Ingresos
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={ordersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
              <XAxis dataKey="date" stroke="#6b7280"/>
              <YAxis stroke="#6b7280"/>
              <Tooltip contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
        }}/>
              <Area type="monotone" dataKey="revenue" fill="#fee2e2" stroke="#dc2626" name="Ingresos ($)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Orders by Category */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">
            Órdenes por Categoría
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
              <XAxis dataKey="category" stroke="#6b7280" angle={-45} textAnchor="end"/>
              <YAxis stroke="#6b7280"/>
              <Tooltip contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
        }}/>
              <Bar dataKey="orders" fill="#3b82f6" name="Órdenes"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Delivery Methods */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">
          Métodos de Entrega
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {deliveryMethods.map((method) => (<div key={method.method} className="bg-muted p-6 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                {method.method}
              </p>
              <p className="text-3xl font-bold text-foreground mb-2">
                {method.percentage}%
              </p>
              <p className="text-sm text-muted-foreground">
                {method.value.toLocaleString()} órdenes
              </p>
              <div className="mt-4 w-full bg-border rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${method.percentage}%` }}/>
              </div>
            </div>))}
        </div>
      </Card>

      {/* Key Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">
          Insights Principales
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="font-medium text-blue-900">
              📈 Mayor crecimiento en finales de semana
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Las órdenes aumentan un 45% los viernes y sábados
            </p>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="font-medium text-green-900">
              ✅ Satisfacción de usuarios en aumento
            </p>
            <p className="text-sm text-green-700 mt-1">
              Rating promedio pasó de 4.3 a 4.6 este mes
            </p>
          </div>
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="font-medium text-orange-900">
              ⚠️ Tiempo de entrega promedio aumentó
            </p>
            <p className="text-sm text-orange-700 mt-1">
              Promedio de 35 minutos, se recomienda optimizar rutas
            </p>
          </div>
        </div>
      </Card>
    </div>);
}
