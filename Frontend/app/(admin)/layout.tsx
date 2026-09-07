'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Building2,
  BarChart3,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const sidebarItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/catalogo', label: 'Catálogo', icon: Package },
  { href: '/inventario', label: 'Inventario', icon: Warehouse },
  { href: '/sucursales', label: 'Sucursales', icon: Building2 },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-neutro-100">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-neutro-900 text-white transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Logo / Toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-neutro-700">
          {sidebarOpen && (
            <span className="text-lg font-bold text-carmin-400">
              🥩 POS Carnicería
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-neutro-700 transition-colors"
            aria-label={sidebarOpen ? 'Colapsar menú' : 'Expandir menú'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {sidebarItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                  isActive
                    ? 'bg-carmin-500 text-white'
                    : 'text-neutro-300 hover:bg-neutro-700 hover:text-white'
                )}
              >
                <item.icon size={22} />
                {sidebarOpen && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-neutro-700">
          <button className="flex items-center gap-3 text-neutro-400 hover:text-white transition-colors w-full px-3 py-2 rounded-xl hover:bg-neutro-700">
            <LogOut size={20} />
            {sidebarOpen && <span className="text-sm">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-neutro-200 flex items-center justify-between px-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutro-800">
            Panel de Administración
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutro-500">
              Sucursal: Principal
            </span>
            <div className="w-8 h-8 bg-carmin-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              A
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
