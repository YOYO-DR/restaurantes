import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MoreVertical, Ban, Mail, } from 'lucide-react';
const mockUsers = [
    {
        id: '1',
        name: 'Juan García',
        email: 'juan@example.com',
        phone: '+57 300 123 4567',
        type: 'cliente',
        status: 'activo',
        joinDate: '2024-01-15',
        orders: 12,
    },
    {
        id: '2',
        name: 'María López',
        email: 'maria@example.com',
        phone: '+57 301 987 6543',
        type: 'cliente',
        status: 'activo',
        joinDate: '2024-02-20',
        orders: 8,
    },
    {
        id: '3',
        name: 'Restaurante Casa del Mar',
        email: 'info@casadelmar.com',
        phone: '+57 600 111 2222',
        type: 'restaurante',
        status: 'activo',
        joinDate: '2023-11-10',
    },
    {
        id: '4',
        name: 'Pedro Rodríguez',
        email: 'pedro@example.com',
        phone: '+57 302 555 8888',
        type: 'cliente',
        status: 'suspendido',
        joinDate: '2024-03-05',
        orders: 3,
    },
    {
        id: '5',
        name: 'Pizzería Italia',
        email: 'info@pizzeria.com',
        phone: '+57 601 333 4444',
        type: 'restaurante',
        status: 'inactivo',
        joinDate: '2024-01-25',
    },
];
export default function AdminUsers() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('todos');
    const filteredUsers = mockUsers.filter((user) => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'todos' || user.type === filterType;
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
    const getTypeBadge = (type) => {
        const baseClass = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium';
        switch (type) {
            case 'cliente':
                return `${baseClass} bg-blue-100 text-blue-800`;
            case 'restaurante':
                return `${baseClass} bg-orange-100 text-orange-800`;
            case 'admin':
                return `${baseClass} bg-purple-100 text-purple-800`;
            default:
                return baseClass;
        }
    };
    return (<div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold text-foreground">
          Gestión de Usuarios
        </h1>
        <p className="text-muted-foreground mt-2">
          Administra todos los usuarios de la plataforma
        </p>
      </div>

      {/* Filters & Search */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5"/>
            <Input placeholder="Buscar por nombre o email..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
          </div>
          <div className="flex gap-2">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-4 py-2 border border-border rounded-lg bg-background">
              <option value="todos">Todos los tipos</option>
              <option value="cliente">Clientes</option>
              <option value="restaurante">Restaurantes</option>
              <option value="admin">Administradores</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Usuario
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Estado
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Fecha de Registro
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (<tr key={user.id} className="border-b border-border hover:bg-muted transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {user.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.phone}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={getTypeBadge(user.type)}>
                      {user.type === 'cliente'
                ? 'Cliente'
                : user.type === 'restaurante'
                    ? 'Restaurante'
                    : 'Admin'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={getStatusBadge(user.status)}>
                      {user.status === 'activo'
                ? 'Activo'
                : user.status === 'inactivo'
                    ? 'Inactivo'
                    : 'Suspendido'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {new Date(user.joinDate).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Mail className="w-4 h-4"/>
                      </Button>
                      {user.status !== 'suspendido' && (<Button size="sm" variant="outline">
                          <Ban className="w-4 h-4"/>
                        </Button>)}
                      <button className="p-2 rounded-lg hover:bg-muted">
                        <MoreVertical className="w-4 h-4 text-muted-foreground"/>
                      </button>
                    </div>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredUsers.length} de {mockUsers.length} usuarios
        </p>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            Anterior
          </Button>
          <Button variant="outline">Siguiente</Button>
        </div>
      </div>
    </div>);
}
