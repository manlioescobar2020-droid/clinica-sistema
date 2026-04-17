import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { RoleName, PaymentStatus } from "@prisma/client"

// ============================================================
// CONSTANTES
// ============================================================

const PAID_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID_CASH,
  PaymentStatus.PAID_TRANSFER,
  PaymentStatus.PAID_CARD,
  PaymentStatus.PAID_MP,
]

const METODO: Record<string, { label: string; color: string }> = {
  PAID_CASH:     { label: "Efectivo",       color: "bg-green-100 text-green-700" },
  PAID_TRANSFER: { label: "Transferencia",  color: "bg-blue-100 text-blue-700"  },
  PAID_CARD:     { label: "Tarjeta",        color: "bg-purple-100 text-purple-700" },
  PAID_MP:       { label: "MercadoPago",    color: "bg-sky-100 text-sky-700"    },
}

// ============================================================
// HELPERS
// ============================================================

function isoDate(d: Date) {
  return d.toISOString().substring(0, 10)
}

function formatDate(d: Date) {
  const [y, m, day] = d.toISOString().substring(0, 10).split("-")
  return `${day}/${m}/${y}`
}

function formatMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function startOfMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

// ============================================================
export const metadata: Metadata = { title: "Reportes" }

// PAGE
// ============================================================

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: { desde?: string; hasta?: string; doctorId?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const role = session.user.role as RoleName
  if (role !== RoleName.ADMIN && role !== RoleName.SECRETARY) redirect("/dashboard")

  const desde    = searchParams.desde    || startOfMonth()
  const hasta    = searchParams.hasta    || isoDate(new Date())
  const doctorId = searchParams.doctorId || ""

  const desdeDate = new Date(`${desde}T00:00:00.000Z`)
  const hastaDate = new Date(`${hasta}T23:59:59.999Z`)

  const [doctores, pagos] = await Promise.all([
    prisma.doctor.findMany({
      where: { deletedAt: null },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.payment.findMany({
      where: {
        status: { in: PAID_STATUSES },
        appointment: {
          startTime: { gte: desdeDate, lte: hastaDate },
          ...(doctorId ? { doctorId } : {}),
        },
      },
      include: {
        appointment: {
          include: {
            person: { select: { firstName: true, lastName: true } },
            doctor: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { appointment: { startTime: "asc" } },
    }),
  ])

  // Totales
  const totales: Record<string, number> = {
    PAID_CASH: 0, PAID_TRANSFER: 0, PAID_CARD: 0, PAID_MP: 0,
  }
  let totalGeneral = 0
  for (const p of pagos) {
    const amt = Number(p.amount)
    totales[p.status] = (totales[p.status] ?? 0) + amt
    totalGeneral += amt
  }

  const exportParams = new URLSearchParams({ desde, hasta })
  if (doctorId) exportParams.set("doctorId", doctorId)
  const exportUrl = `/api/export/reportes?${exportParams}`

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes de Caja</h1>
          <p className="text-sm text-gray-500 mt-1">Pagos confirmados del período seleccionado</p>
        </div>
        <a
          href={exportUrl}
          className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg transition text-sm"
        >
          ↓ Exportar CSV
        </a>
      </div>

      {/* Filtros */}
      <form
        method="GET"
        className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-wrap items-end gap-4"
      >
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input
            type="date"
            name="desde"
            defaultValue={desde}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Doctor</label>
          <select
            name="doctorId"
            defaultValue={doctorId}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los doctores</option>
            {doctores.map((d) => (
              <option key={d.id} value={d.id}>{d.user.name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition text-sm"
        >
          Filtrar
        </button>
      </form>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Object.entries(METODO).map(([status, { label, color }]) => (
          <div key={status} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-lg font-bold text-gray-900">{formatMoney(totales[status] ?? 0)}</p>
            <span className={`mt-1.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
              {pagos.filter((p) => p.status === status).length} pagos
            </span>
          </div>
        ))}
        <div className="bg-blue-600 rounded-xl p-4 flex flex-col justify-between">
          <p className="text-xs text-blue-200 mb-1">Total general</p>
          <p className="text-lg font-bold text-white">{formatMoney(totalGeneral)}</p>
          <span className="mt-1.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500 text-white">
            {pagos.length} pagos
          </span>
        </div>
      </div>

      {/* Tabla de detalle */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Detalle de pagos</h2>
          <span className="text-xs text-gray-400">
            {desde} → {hasta}
          </span>
        </div>

        {pagos.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No hay pagos registrados en el período seleccionado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Paciente</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Doctor</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Método</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pagos.map((pago) => (
                  <tr key={pago.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 text-xs tabular-nums">
                      {formatDate(pago.appointment.startTime)}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {pago.appointment.person.firstName} {pago.appointment.person.lastName}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {pago.appointment.doctor.user.name}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          METODO[pago.status]?.color ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {METODO[pago.status]?.label ?? pago.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900 tabular-nums">
                      {formatMoney(Number(pago.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right font-semibold text-gray-700">
                    Total del período
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900 text-base tabular-nums">
                    {formatMoney(totalGeneral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
