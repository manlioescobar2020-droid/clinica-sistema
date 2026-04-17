import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { RoleName, AuditAction, Prisma } from "@prisma/client"

// ============================================================
// CONSTANTES
// ============================================================

const ENTITIES = ["Appointment", "Payment", "Person", "AgendaBlock"] as const

const ACTION_LABELS: Record<AuditAction, { label: string; color: string }> = {
  CREATE:               { label: "Crear",            color: "bg-green-100 text-green-700"  },
  UPDATE:               { label: "Editar",            color: "bg-blue-100 text-blue-700"   },
  DELETE:               { label: "Eliminar",          color: "bg-red-100 text-red-700"     },
  SOFT_DELETE:          { label: "Desactivar",        color: "bg-orange-100 text-orange-700"},
  RESTORE:              { label: "Restaurar",         color: "bg-teal-100 text-teal-700"   },
  STATUS_CHANGE:        { label: "Cambio de estado",  color: "bg-yellow-100 text-yellow-700"},
  PAYMENT_REGISTERED:   { label: "Pago registrado",   color: "bg-emerald-100 text-emerald-700"},
  REFUND_ISSUED:        { label: "Devolución",        color: "bg-pink-100 text-pink-700"   },
  AGENDA_BLOCKED:       { label: "Agenda bloqueada",  color: "bg-purple-100 text-purple-700"},
  AGENDA_UNBLOCKED:     { label: "Agenda desbloqueada",color:"bg-indigo-100 text-indigo-700"},
}

const ENTITY_LABELS: Record<string, string> = {
  Appointment: "Turno",
  Payment:     "Pago",
  Person:      "Persona",
  AgendaBlock: "Bloqueo de agenda",
}

// ============================================================
// HELPERS
// ============================================================

function formatDateTime(d: Date) {
  const [date, time] = d.toISOString().split("T")
  const [y, m, day] = date.split("-")
  return { date: `${day}/${m}/${y}`, time: time.substring(0, 5) }
}

function shortId(id: string) {
  return id.substring(0, 8) + "…"
}

// ============================================================
export const metadata: Metadata = { title: "Auditoría" }

// PAGE
// ============================================================

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { entity?: string; action?: string; page?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== RoleName.ADMIN) redirect("/dashboard")

  const entity = searchParams.entity || ""
  const action = searchParams.action || ""
  const page   = Math.max(1, parseInt(searchParams.page || "1"))
  const PAGE_SIZE = 50

  const where: Prisma.AuditLogWhereInput = {
    ...(entity && { entity }),
    ...(action  && { action: action as AuditAction }),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Construye URL de paginación conservando filtros activos
  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (entity) params.set("entity", entity)
    if (action) params.set("action", action)
    params.set("page", String(p))
    return `/dashboard/auditlog?${params}`
  }

  const exportParams = new URLSearchParams()
  if (entity) exportParams.set("entity", entity)
  if (action) exportParams.set("action", action)
  const exportUrl = `/api/export/auditlog${exportParams.toString() ? `?${exportParams}` : ""}`

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoría del Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total.toLocaleString("es-AR")} registros en total
          </p>
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
          <label className="block text-xs font-medium text-gray-600 mb-1">Entidad</label>
          <select
            name="entity"
            defaultValue={entity}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las entidades</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>{ENTITY_LABELS[e] ?? e}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Acción</label>
          <select
            name="action"
            defaultValue={action}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition text-sm"
          >
            Filtrar
          </button>
          {(entity || action) && (
            <a
              href="/dashboard/auditlog"
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition text-sm"
            >
              Limpiar
            </a>
          )}
        </div>
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Historial de acciones</h2>
          {totalPages > 1 && (
            <span className="text-xs text-gray-400">
              Página {page} de {totalPages}
            </span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No hay registros para los filtros seleccionados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Usuario</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Entidad</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Acción</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">ID registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => {
                  const { date, time } = formatDateTime(log.createdAt)
                  const actionMeta = ACTION_LABELS[log.action]
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 tabular-nums text-gray-500 text-xs whitespace-nowrap">
                        <span className="font-medium text-gray-700">{date}</span>
                        <span className="ml-1.5 text-gray-400">{time}</span>
                      </td>
                      <td className="px-5 py-3">
                        {log.user ? (
                          <>
                            <p className="font-medium text-gray-900 leading-tight">{log.user.name}</p>
                            <p className="text-xs text-gray-400">{log.user.email}</p>
                          </>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Sistema</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {ENTITY_LABELS[log.entity] ?? log.entity}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${actionMeta?.color ?? "bg-gray-100 text-gray-700"}`}>
                          {actionMeta?.label ?? log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-400" title={log.entityId}>
                        {shortId(log.entityId)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString("es-AR")}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={pageUrl(page - 1)}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Anterior
                </a>
              )}
              {page < totalPages && (
                <a
                  href={pageUrl(page + 1)}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Siguiente →
                </a>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
