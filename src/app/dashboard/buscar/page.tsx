import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export const metadata: Metadata = { title: "Búsqueda" }

const PERSON_STATUS: Record<string, { label: string; color: string }> = {
  PROSPECT: { label: "Prospecto", color: "bg-yellow-50 text-yellow-700" },
  ACTIVE:   { label: "Activo",    color: "bg-green-50 text-green-700"  },
  INACTIVE: { label: "Inactivo",  color: "bg-gray-50 text-gray-600"    },
  ARCHIVED: { label: "Archivado", color: "bg-red-50 text-red-600"      },
}

const APPT_STATUS: Record<string, { label: string; color: string }> = {
  RESERVED:          { label: "Reservado",       color: "bg-yellow-100 text-yellow-800" },
  CONFIRMED:         { label: "Confirmado",       color: "bg-blue-100 text-blue-800"    },
  ATTENDED:          { label: "Atendido",         color: "bg-green-100 text-green-800"  },
  CANCELLED_PATIENT: { label: "Cancel. Paciente", color: "bg-red-100 text-red-800"      },
  CANCELLED_CLINIC:  { label: "Cancel. Clínica",  color: "bg-orange-100 text-orange-800"},
  NO_SHOW:           { label: "No asistió",       color: "bg-gray-100 text-gray-800"    },
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const q = (searchParams.q ?? "").trim()

  if (!q) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Búsqueda global</h1>
          <p className="text-sm text-gray-500">
            Escribí un nombre, apellido o DNI en la barra de búsqueda y presioná Enter.
          </p>
        </div>
      </div>
    )
  }

  const [persons, appointments] = await Promise.all([
    prisma.person.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName:  { contains: q, mode: "insensitive" } },
          { dni: { contains: q } },
        ],
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 20,
    }),
    prisma.appointment.findMany({
      where: {
        person: {
          deletedAt: null,
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName:  { contains: q, mode: "insensitive" } },
            { dni: { contains: q } },
          ],
        },
      },
      include: {
        person: { select: { id: true, firstName: true, lastName: true, dni: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
      orderBy: { startTime: "desc" },
      take: 30,
    }),
  ])

  const totalResults = persons.length + appointments.length

  return (
    <div className="p-6 space-y-8 max-w-4xl">

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Resultados para <span className="text-blue-600">&ldquo;{q}&rdquo;</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {totalResults === 0
            ? "Sin resultados"
            : `${persons.length} persona${persons.length !== 1 ? "s" : ""} · ${appointments.length} turno${appointments.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {totalResults === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center text-gray-400">
          <p className="text-lg">No se encontraron resultados</p>
          <p className="text-sm mt-1">Intentá con otro nombre, apellido o DNI</p>
        </div>
      )}

      {/* Sección: Personas */}
      {persons.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Personas ({persons.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {persons.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/personas/${p.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
                    {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {p.lastName}, {p.firstName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      DNI {p.dni}
                      {p.phone && <> · {p.phone}</>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PERSON_STATUS[p.status]?.color}`}>
                    {PERSON_STATUS[p.status]?.label}
                  </span>
                  <span className="text-blue-500 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver perfil →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sección: Turnos */}
      {appointments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Turnos ({appointments.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {appointments.map((appt) => (
              <Link
                key={appt.id}
                href={`/dashboard/turnos/${appt.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {appt.person.lastName}, {appt.person.firstName}
                    <span className="text-gray-400 font-normal text-sm ml-2">
                      DNI {appt.person.dni}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {format(
                      new Date(appt.startTime),
                      "EEEE d 'de' MMMM yyyy 'a las' HH:mm",
                      { locale: es }
                    )}
                    <span className="mx-1.5">·</span>
                    {appt.doctor.user.name}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${APPT_STATUS[appt.status]?.color}`}>
                    {APPT_STATUS[appt.status]?.label}
                  </span>
                  <span className="text-blue-500 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver turno →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
