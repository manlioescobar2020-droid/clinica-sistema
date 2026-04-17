import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAppointments } from "@/lib/actions/appointments"
import { getDoctors } from "@/lib/actions/doctors"
import { AppointmentStatus } from "@prisma/client"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export const metadata: Metadata = { title: "Turnos" }

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: { date?: string; doctorId?: string; status?: string }
}) {
  const session = await getServerSession(authOptions)
  const today = searchParams.date ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })

  const [appointments, doctors] = await Promise.all([
    getAppointments({
      date: today,
      doctorId: searchParams.doctorId,
      status: searchParams.status as AppointmentStatus | undefined,
    }),
    getDoctors(),
  ])

  const statusLabels: Record<string, { label: string; color: string }> = {
    RESERVED:          { label: "Reservado",       color: "bg-yellow-100 text-yellow-800" },
    CONFIRMED:         { label: "Confirmado",       color: "bg-blue-100 text-blue-800" },
    ATTENDED:          { label: "Atendido",         color: "bg-green-100 text-green-800" },
    CANCELLED_PATIENT: { label: "Cancel. Paciente", color: "bg-red-100 text-red-800" },
    CANCELLED_CLINIC:  { label: "Cancel. Clínica",  color: "bg-orange-100 text-orange-800" },
    NO_SHOW:           { label: "No asistió",       color: "bg-gray-100 text-gray-800" },
  }

  // Navegación rápida de fechas
  const actualToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
  const pivot = new Date(actualToday + "T12:00:00.000Z")
  const ayer   = new Date(pivot.getTime() - 86_400_000).toISOString().substring(0, 10)
  const manana = new Date(pivot.getTime() + 86_400_000).toISOString().substring(0, 10)

  function navUrl(date: string) {
    const p = new URLSearchParams({ date })
    if (searchParams.doctorId) p.set("doctorId", searchParams.doctorId)
    if (searchParams.status)   p.set("status",   searchParams.status)
    return `/dashboard/turnos?${p}`
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Turnos</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">
            {format(new Date(today + "T12:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Navegación rápida */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium divide-x divide-gray-300">
            {([
              { label: "Ayer",   date: ayer        },
              { label: "Hoy",    date: actualToday },
              { label: "Mañana", date: manana      },
            ] as const).map(({ label, date }) => (
              <Link
                key={date}
                href={navUrl(date)}
                className={`px-4 py-2 transition-colors ${
                  today === date
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 bg-white hover:bg-gray-50"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <Link
            href="/dashboard/turnos/nuevo"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Nuevo turno
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3 bg-white p-4 rounded-xl border border-gray-200">
        {/* Fecha */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Fecha</label>
          <input
            type="date"
            name="date"
            defaultValue={today}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Doctor */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Doctor</label>
          <select
            name="doctorId"
            defaultValue={searchParams.doctorId ?? ""}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.user.name}
              </option>
            ))}
          </select>
        </div>

        {/* Estado */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Estado</label>
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Filtrar
          </button>
        </div>
      </form>

      {/* Resumen del día */}
      {(() => {
        const total     = appointments.length
        const atendidos = appointments.filter(a => a.status === "ATTENDED").length
        const pendientes = appointments.filter(a => a.status === "RESERVED" || a.status === "CONFIRMED").length
        return (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total del día</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{total}</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 px-5 py-4">
              <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Atendidos</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{atendidos}</p>
            </div>
            <div className="bg-white rounded-xl border border-yellow-200 px-5 py-4">
              <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide">Pendientes</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">{pendientes}</p>
            </div>
          </div>
        )
      })()}

      {/* Tabla de turnos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {appointments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No hay turnos para este día</p>
            <p className="text-sm mt-1">Podés crear uno con el botón de arriba</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Hora</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Paciente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pago</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">
                    {appt.startTime.toISOString().substring(11, 16)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {appt.person.firstName} {appt.person.lastName}
                    </p>
                    <p className="text-xs text-gray-500">DNI {appt.person.dni}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {appt.doctor.user.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusLabels[appt.status]?.color}`}>
                      {statusLabels[appt.status]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      appt.payment?.status === "NO_PAYMENT"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {appt.payment?.status === "NO_PAYMENT"
                        ? "Sin pago"
                        : appt.payment?.status === "PAID_CASH"
                        ? "Efectivo"
                        : appt.payment?.status === "PAID_MP"
                        ? "Mercado Pago"
                        : appt.payment?.status === "PAID_TRANSFER"
                        ? "Transferencia"
                        : appt.payment?.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/turnos/${appt.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                    >
                      Ver detalle →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}