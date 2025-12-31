'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Clock,
  MapPin,
  FileText,
  Settings,
  LogOut,
  MapPin as Logo,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/registros', label: 'Registros', icon: Clock },
  { href: '/dashboard/locais', label: 'Locais', icon: MapPin },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: FileText },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuthStore();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <Logo className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">OnSite Flow</h1>
            <p className="text-xs text-gray-500">Gerenciador</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition mt-2"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
