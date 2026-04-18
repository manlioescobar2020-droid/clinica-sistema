import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { RoleName, AppointmentStatus, Prisma } from "@prisma/client"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

async function getDashboardData(userId: string, role: RoleName) {
  const today = new Date()
  const startOfDay = new Date(today.toISOString().split("T")[0] + "T00:00:00.000Z")
  const endOfDay = new Date(today.toISOString().split("T")[0] + "T23:59:59.999Z")

  // Si es secretaria, obtener solo los doctores asignados
  let doctorIds: string[] | undefined = undefined

  if (role === RoleName.SECRETARY) {
    const secretary = await prisma.secretary.findFirst({
      where: { user: { id: userId }, deletedAt: null },
      include: { secretaryDoctors: true },
    })
    doctorIds = secretary?.secretaryDoctors.map((sd) => sd.doctorId) ?? []
  }

  if (role === RoleName.DOCTOR) {
    const doctor = await prisma.doctor.findFirst({
      where: { user: { id: userId }, deletedAt: null },
    })
    doctorIds = doctor ? [doctor.id] : []
  }

  const whereBase: Prisma.AppointmentWhereInput = {
    startTime: { gte: startOfDay, lte: endOfDay },
  }
  if (doctorIds !== undefined) {
    whereBase.doctorId = { in: doctorIds }
  }

  // Próximos 7 días (mañana → +7 días), excluyendo cancelados
  const tomorrow = new Date(endOfDay.getTime() + 1)
  const in7Days  = new Date(startOfDay.getTime() + 8 * 86_400_000 - 1)
  const whereUpcoming: Prisma.AppointmentWhereInput = {
    startTime: { gte: tomorrow, lte: in7Days },
    status: { notIn: ["CANCELLED_PATIENT", "CANCELLED_CLINIC"] },
  }
  if (doctorIds !== undefined) {
    whereUpcoming.doctorId = { in: doctorIds }
  }

  // Turnos de hoy + próximos en paralelo
  const [appointments, upcoming] = await Promise.all([
    prisma.appointment.findMany({
      where: whereBase,
      include: {
        person: { select: { firstName: true, lastName: true, dni: true } },
        doctor: { include: { user: { select: { name: true } } } },
        payment: true,
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.appointment.findMany({
      where: whereUpcoming,
      include: {
        person: { select: { firstName: true, lastName: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
      orderBy: { startTime: "asc" },
      take: 50,
    }),
  ])

  // Conteos por estado
  const counts = {
    RESERVED: 0,
    CONFIRMED: 0,
    ATTENDED: 0,
    CANCELLED_PATIENT: 0,
    CANCELLED_CLINIC: 0,
    NO_SHOW: 0,
  } as Record<AppointmentStatus, number>

  for (const a of appointments) {
    counts[a.status] = (counts[a.status] ?? 0) + 1
  }

  // Caja del día
  const cajaTotal = appointments.reduce((acc, a) => {
    if (!a.payment) return acc
    if (["PAID_CASH", "PAID_MP", "PAID_TRANSFER", "PAID_CARD"].includes(a.payment.status)) {
      return acc + Number(a.payment.amount)
    }
    return acc
  }, 0)

  // Alertas
  const sinPago = appointments.filter(
    (a) => a.payment?.status === "NO_PAYMENT" &&
      !["CANCELLED_PATIENT", "CANCELLED_CLINIC"].includes(a.status)
  ).length

  return { appointments, counts, cajaTotal, sinPago, upcoming }
}

export const metadata: Metadata = { title: "Inicio" }

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const role = session.user.role as RoleName
  const { appointments, counts, cajaTotal, sinPago, upcoming } = await getDashboardData(
    session.user.id,
    role
  )

  const today = new Date()
  const todayLabel = format(today, "EEEE d 'de' MMMM yyyy", { locale: es })

  const statusLabels: Record<string, { label: string; color: string }> = {
    RESERVED:          { label: "Reservados",       color: "bg-yellow-100 text-yellow-800" },
    CONFIRMED:         { label: "Confirmados",      color: "bg-blue-100 text-blue-800" },
    ATTENDED:          { label: "Atendidos",        color: "bg-green-100 text-green-800" },
    CANCELLED_PATIENT: { label: "Cancel. Paciente", color: "bg-red-100 text-red-800" },
    CANCELLED_CLINIC:  { label: "Cancel. Clínica",  color: "bg-orange-100 text-orange-800" },
    NO_SHOW:           { label: "No asistieron",    color: "bg-gray-100 text-gray-800" },
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          👋 Bienvenido, {session.user.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{todayLabel}</p>
      </div>

      {/* Tarjetas de estado */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{count}</p>
            <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[status]?.color}`}>
              {statusLabels[status]?.label}
            </span>
          </div>
        ))}
      </div>

      {/* Caja + Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Caja del día */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500 mb-1">💰 Caja del día</p>
          <p className="text-3xl font-bold text-green-600">
            ${cajaTotal.toLocaleString("es-AR")}
          </p>
          <p className="text-xs text-gray-400 mt-1">Solo pagos confirmados</p>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <p className="text-sm font-medium text-gray-500">⚠️ Alertas</p>
          {sinPago === 0 && counts.NO_SHOW === 0 ? (
            <p className="text-sm text-green-600 font-medium">✅ Todo en orden</p>
          ) : (
            <>
              {sinPago > 0 && (
                <div className="flex items-center justify-between bg-yellow-50 rounded-lg px-3 py-2">
                  <p className="text-sm text-yellow-800">Turnos sin pago</p>
                  <span className="font-bold text-yellow-800">{sinPago}</span>
                </div>
              )}
              {counts.NO_SHOW > 0 && (
                <div className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                  <p className="text-sm text-red-800">No asistieron</p>
                  <span className="font-bold text-red-800">{counts.NO_SHOW}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Turnos del día */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Turnos de hoy</h2>
          <Link
            href="/dashboard/turnos"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver todos →
          </Link>
        </div>

        {appointments.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>No hay turnos para hoy</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Hora</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Paciente</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Doctor</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {appointments.map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono font-medium text-gray-900">
                    {appt.startTime.toISOString().substring(11, 16)}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">
                      {appt.person.firstName} {appt.person.lastName}
                    </p>
                    <p className="text-xs text-gray-400">DNI {appt.person.dni}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {appt.doctor.user.name}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusLabels[appt.status]?.color}`}>
                      {statusLabels[appt.status]?.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/dashboard/turnos/${appt.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Próximos 7 días */}
      {upcoming.length > 0 && (() => {
        // Agrupar por fecha YYYY-MM-DD
        const byDay: Record<string, typeof upcoming> = {}
        for (const appt of upcoming) {
          const key = appt.startTime.toISOString().substring(0, 10)
          ;(byDay[key] ??= []).push(appt)
        }
        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Próximos 7 días</h2>
              <Link
                href="/dashboard/turnos"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Ver todos →
              </Link>
            </div>
            {Object.entries(byDay).map(([date, dayAppts]) => (
              <div key={date}>
                <div className="px-5 py-2 bg-gray-50 border-y border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide capitalize">
                    {format(new Date(date + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}
                    <span className="ml-2 font-normal normal-case text-gray-400">
                      {dayAppts.length} turno{dayAppts.length !== 1 ? "s" : ""}
                    </span>
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {dayAppts.map((appt) => (
                    <Link
                      key={appt.id}
                      href={`/dashboard/turnos/${appt.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm font-medium text-gray-900 w-12 shrink-0">
                          {appt.startTime.toISOString().substring(11, 16)}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {appt.person.firstName} {appt.person.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{appt.doctor.user.name}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusLabels[appt.status]?.color}`}>
                        {statusLabels[appt.status]?.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

    </div>
  )
}