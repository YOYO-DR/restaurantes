import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { BarChart3, ClipboardList, CreditCard, Layers, Users, Store, Settings, LogOut, Menu, X, } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
export function AdminSidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const { pathname } = useLocation();
    const menuItems = [
        {
            icon: BarChart3,
            label: 'Dashboard',
            href: '/dashboard/admin',
        },
        {
            icon: Users,
            label: 'Usuarios',
            href: '/dashboard/admin/usuarios',
        },
        {
            icon: Store,
            label: 'Restaurantes',
            href: '/dashboard/admin/restaurantes',
        },
        {
            icon: BarChart3,
            label: 'Reportes',
            href: '/dashboard/admin/reportes',
        },
        {
            icon: Settings,
            label: 'Configuración',
            href: '/dashboard/admin/configuracion',
        },
        {
            icon: Layers,
            label: 'Funcionalidades',
            href: '/dashboard/admin/funcionalidades',
        },
        {
            icon: CreditCard,
            label: 'Planes',
            href: '/dashboard/admin/planes',
        },
        {
            icon: ClipboardList,
            label: 'Solicitudes',
            href: '/dashboard/admin/solicitudes',
        },
    ];
    const isActive = (href) => pathname === href;
    return (<>
      {/* Mobile Toggle */}
      <button onClick={() => setIsOpen(!isOpen)} className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-primary text-primary-foreground">
        {isOpen ? <X className="w-6 h-6"/> : <Menu className="w-6 h-6"/>}
      </button>

      {/* Sidebar */}
      <aside className={`fixed md:sticky md:top-0 md:self-start w-64 h-screen bg-sidebar border-r border-sidebar-border transition-transform duration-300 md:translate-x-0 z-40 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-sidebar-border mt-16 md:mt-0">
          <h1 className="text-2xl font-display font-bold text-sidebar-primary">
            FoodHub Admin
          </h1>
          <p className="text-sm text-sidebar-accent-foreground">Gestión</p>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (<Link key={item.href} to={item.href} onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}>
                <Icon className="w-5 h-5"/>
                <span className="font-medium">{item.label}</span>
              </Link>);
        })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Button className="w-full justify-start gap-3" variant="outline">
            <LogOut className="w-5 h-5"/>
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (<div className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-30" onClick={() => setIsOpen(false)}/>)}
    </>);
}
