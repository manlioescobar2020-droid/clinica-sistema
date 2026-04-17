import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { RoleName } from "@prisma/client"
import { getUnreadCount, getMyNotifications } from "@/lib/actions/notifications"
import NotificationBell from "@/components/NotificationBell"

const navItems = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: "🏠",
    roles: [RoleName.ADMIN, RoleName.DOCTOR, RoleName.SECRETARY],
  },
  {
    href: "/dashboard/turnos",
    label: "Turnos",
    icon: "📅",
    roles: [RoleName.ADMIN, RoleName.DOCTOR, RoleName.SECRETARY],
  },
  {
    href: "/dashboard/personas",
    label: "Pacientes",
    icon: "👥",
    roles: [RoleName.ADMIN, RoleName.SECRETARY],
  },
  {
    href: "/dashboard/doctores",
    label: "Doctores",
    icon: "🩺",
    roles: [RoleName.ADMIN],
  },
  {
    href: "/dashboard/secretarias",
    label: "Secretarias",
    icon: "💼",
    roles: [RoleName.ADMIN],
  },
  {
    href: "/dashboard/reportes",
    label: "Reportes",
    icon: "📊",
    roles: [RoleName.ADMIN, RoleName.SECRETARY],
  },
  {
    href: "/dashboard/auditlog",
    label: "Auditoría",
    icon: "🔍",
    roles: [RoleName.ADMIN],
  },
  {
    href: "/dashboard/configuracion",
    label: "Configuración",
    icon: "⚙️",
    roles: [RoleName.ADMIN],
  },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const role = session.user.role as RoleName
  const visibleItems = navItems.filter((item) => item.roles.includes(role))

  const [unreadCount, notifications] = await Promise.all([
    getUnreadCount(),
    getMyNotifications(),
  ])

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10">

        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">🏥 Clínica</h1>
          <p className="text-xs text-gray-500 mt-1">Sistema de Gestión</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Usuario + Logout */}
        <div className="p-4 border-t border-gray-100">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-gray-900 truncate">{session.user.name}</p>
            <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
              {role}
            </span>
          </div>
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors w-full"
          >
            <span>🚪</span> Cerrar sesión
          </Link>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 ml-64 flex flex-col">

        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-10">
          <form action="/dashboard/buscar" method="GET">
            <input
              type="search"
              name="q"
              placeholder="Buscar paciente, DNI..."
              className="w-72 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
            />
          </form>
          <NotificationBell
            initialCount={unreadCount}
            initialNotifications={notifications}
          />
        </header>

        <main className="flex-1">
          {children}
        </main>

      </div>
    </div>
  )
}