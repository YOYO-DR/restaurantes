import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MoreVertical, Eye, Edit, } from 'lucide-react';
const mockRestaurants = [
    {
        id: '1',
        name: 'Restaurante Casa del Mar',
        owner: 'Carlos Mendez',
        category: 'Mariscos',
        status: 'activo',
        rating: 4.8,
        totalOrders: 1250,
        revenue: 85000,
        joinDate: '2023-11-10',
        subscriptionPlan: 'Premium',
    },
    {
        id: '2',
        name: 'Pizzería Italia',
        owner: 'Roberto González',
        category: 'Italiana',
        status: 'activo',
        rating: 4.6,
        totalOrders: 980,
        revenue: 62000,
        joinDate: '2024-01-25',
        subscriptionPlan: 'Professional',
    },
    {
        id: '3',
        name: 'Burguer House',
        owner: 'Ana Martínez',
        category: 'Hamburguesas',
        status: 'activo',
        rating: 4.4,
        totalOrders: 1500,
        revenue: 95000,
        joinDate: '2023-09-15',
        subscriptionPlan: 'Premium',
    },
    {
        id: '4',
        name: 'Sushi Bar Premium',
        owner: 'Kenji Tanaka',
        category: 'Sushi',
        status: 'inactivo',
        rating: 4.7,
        totalOrders: 450,
        revenue: 28000,
        joinDate: '2024-02-01',
        subscriptionPlan: 'Starter',
    },
    {
        id: '5',
        name: 'Comidas Criollas Mama Rosa',
        owner: 'Rosa García',
        category: 'Comida Criolla',
        status: 'suspendido',
        rating: 3.9,
        totalOrders: 320,
        revenue: 15000,
        joinDate: '2024-03-10',
        subscriptionPlan: 'Starter',
    },
];
export default function AdminRestaurants() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const filteredRestaurants = mockRestaurants.filter((restaurant) => {
        const matchesSearch = restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            restaurant.owner.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = statusFilter === 'todos' || restaurant.status === statusFilter;
        return matchesSearch && matchesFilter;
    });
    const getStatusBadge = (status) => {
        const baseClass = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium';
        switch (status) {
            case 'activo':
                return `${baseClass} bg-green-100 text-green-800`;
            case 'inactivo':
                return `${baseClass} bg-gray-100 text-gray-800`;
            case 'suspendido':
                return `${baseClass} bg-red-100 text-red-800`;
            default:
                return baseClass;
        }
    };
    const getRatingColor = (rating) => {
        if (rating >= 4.7)
            return 'text-green-600';
        if (rating >= 4.0)
            return 'text-blue-600';
        if (rating >= 3.5)
            return 'text-orange-600';
        return 'text-red-600';
    };
    return (<div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-foreground">
            Gestión de Restaurantes
          </h1>
          <p className="text-muted-foreground mt-2">
            Administra todos los restaurantes de la plataforma
          </p>
        </div>
        <Button>Nuevo Restaurante</Button>
      </div>

      {/* Filters & Search */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5"/>
            <Input placeholder="Buscar por nombre o propietario..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
          </div>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-border rounded-lg bg-background">
              <option value="todos">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
              <option value="suspendido">Suspendidos</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Restaurants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRestaurants.map((restaurant) => (<Card key={restaurant.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-foreground text-lg">
                    {restaurant.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {restaurant.category}
                  </p>
                </div>
                <button className="p-2 rounded-lg hover:bg-muted">
                  <MoreVertical className="w-4 h-4 text-muted-foreground"/>
                </button>
              </div>

              {/* Owner */}
              <p className="text-sm text-muted-foreground mb-4">
                Propietario: <span className="font-medium text-foreground">{restaurant.owner}</span>
              </p>

              {/* Status */}
              <div className="mb-4">
                <span className={getStatusBadge(restaurant.status)}>
                  {restaurant.status === 'activo'
                ? 'Activo'
                : restaurant.status === 'inactivo'
                    ? 'Inactivo'
                    : 'Suspendido'}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Rating</p>
                  <p className={`text-lg font-bold ${getRatingColor(restaurant.rating)}`}>
                    {restaurant.rating}
                  </p>
                </div>
                <div className="bg-muted p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Órdenes</p>
                  <p className="text-lg font-bold text-foreground">
                    {restaurant.totalOrders}
                  </p>
                </div>
                <div className="bg-muted p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Ingresos</p>
                  <p className="text-lg font-bold text-foreground">
                    ${(restaurant.revenue / 1000).toFixed(0)}k
                  </p>
                </div>
              </div>

              {/* Plan & Date */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan:</span>
                  <span className="font-medium text-foreground">
                    {restaurant.subscriptionPlan}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Registro:</span>
                  <span className="font-medium text-foreground">
                    {new Date(restaurant.joinDate).toLocaleDateString('es-CO')}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" className="flex-1">
                  <Eye className="w-4 h-4 mr-2"/>
                  Ver
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  <Edit className="w-4 h-4 mr-2"/>
                  Editar
                </Button>
              </div>
            </div>
          </Card>))}
      </div>

      {/* Empty State */}
      {filteredRestaurants.length === 0 && (<Card className="p-12 text-center">
          <p className="text-muted-foreground">
            No se encontraron restaurantes con los filtros aplicados
          </p>
        </Card>)}
    </div>);
}
