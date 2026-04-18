import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { RoleName } from "@prisma/client"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  // Solo pacientes y prospectos acceden al portal
  if (!([RoleName.PATIENT, RoleName.PROSPECT] as RoleName[]).includes(session.user.role)) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">🏥 Mi Portal</h1>
            <p className="text-xs text-gray-500">Clínica — Portal del Paciente</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session.user.name}</span>
            <Link
              href="/api/auth/signout"
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              Salir
            </Link>
          </div>
        </div>

        {/* Nav */}
        <div className="max-w-3xl mx-auto px-6 flex gap-6 border-t border-gray-100">
          <Link
            href="/portal"
            className="py-3 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-colors"
          >
            Mis Turnos
          </Link>
          <Link
            href="/portal/historial"
            className="py-3 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-colors"
          >
            Historial
          </Link>
          <Link
            href="/portal/perfil"
            className="py-3 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-colors"
          >
            Mi Perfil
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {children}
      </main>

    </div>
  )
}