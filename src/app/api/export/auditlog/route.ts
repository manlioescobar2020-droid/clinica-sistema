import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditAction, RoleName, Prisma } from "@prisma/client"
import { toCsv } from "@/lib/csv"

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE:             "Crear",
  UPDATE:             "Editar",
  DELETE:             "Eliminar",
  SOFT_DELETE:        "Desactivar",
  RESTORE:            "Restaurar",
  STATUS_CHANGE:      "Cambio de estado",
  PAYMENT_REGISTERED: "Pago registrado",
  REFUND_ISSUED:      "Devolución",
  AGENDA_BLOCKED:     "Agenda bloqueada",
  AGENDA_UNBLOCKED:   "Agenda desbloqueada",
}

const ENTITY_LABELS: Record<string, string> = {
  Appointment: "Turno",
  Payment:     "Pago",
  Person:      "Persona",
  AgendaBlock: "Bloqueo de agenda",
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new NextResponse("No autorizado", { status: 401 })
  }

  if (session.user.role !== RoleName.ADMIN) {
    return new NextResponse("Acceso denegado", { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const entity = params.get("entity") || ""
  const action = params.get("action") || ""

  const where: Prisma.AuditLogWhereInput = {
    ...(entity && { entity }),
    ...(action  && { action: action as AuditAction }),
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  })

  const headers = ["Fecha", "Hora", "Usuario", "Email", "Entidad", "Acción", "ID registro"]

  const rows = logs.map((log) => {
    const iso  = log.createdAt.toISOString()
    const [y, m, d] = iso.substring(0, 10).split("-")
    const time = iso.substring(11, 16)
    return [
      `${d}/${m}/${y}`,
      time,
      log.user?.name  ?? "Sistema",
      log.user?.email ?? "",
      ENTITY_LABELS[log.entity] ?? log.entity,
      ACTION_LABELS[log.action] ?? log.action,
      log.entityId,
    ]
  })

  const csv      = toCsv(headers, rows)
  const dateTag  = new Date().toISOString().substring(0, 10)
  const filename = `auditoria_${dateTag}${entity ? `_${entity}` : ""}${action ? `_${action}` : ""}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
