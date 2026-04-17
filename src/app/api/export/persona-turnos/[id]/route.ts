import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { RoleName } from "@prisma/client"
import { toCsv } from "@/lib/csv"

const STAFF_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.SECRETARY, RoleName.DOCTOR]

const STATUS_LABELS: Record<string, string> = {
  RESERVED:          "Reservado",
  CONFIRMED:         "Confirmado",
  ATTENDED:          "Atendido",
  CANCELLED_PATIENT: "Cancelado por paciente",
  CANCELLED_CLINIC:  "Cancelado por clínica",
  NO_SHOW:           "No asistió",
}

const PAYMENT_LABELS: Record<string, string> = {
  NO_PAYMENT:    "Sin pago",
  PAID_CASH:     "Efectivo",
  PAID_TRANSFER: "Transferencia",
  PAID_CARD:     "Tarjeta",
  PAID_MP:       "MercadoPago",
  REFUNDED:      "Devuelto",
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new NextResponse("No autorizado", { status: 401 })
  }

  if (!STAFF_ROLES.includes(session.user.role as RoleName)) {
    return new NextResponse("Acceso denegado", { status: 403 })
  }

  const person = await prisma.person.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { firstName: true, lastName: true, dni: true },
  })

  if (!person) {
    return new NextResponse("Persona no encontrada", { status: 404 })
  }

  const appointments = await prisma.appointment.findMany({
    where: { personId: params.id },
    include: {
      doctor:  { include: { user: { select: { name: true } } } },
      payment: { select: { status: true, amount: true } },
    },
    orderBy: { startTime: "desc" },
  })

  const headers = ["Fecha", "Hora", "Doctor", "Estado", "Método de pago", "Monto"]

  const rows = appointments.map((appt) => {
    const iso   = appt.startTime.toISOString()
    const [y, m, d] = iso.substring(0, 10).split("-")
    const time  = iso.substring(11, 16)
    return [
      `${d}/${m}/${y}`,
      time,
      appt.doctor.user.name,
      STATUS_LABELS[appt.status]  ?? appt.status,
      PAYMENT_LABELS[appt.payment?.status ?? "NO_PAYMENT"] ?? "",
      appt.payment ? Number(appt.payment.amount).toFixed(2) : "0.00",
    ]
  })

  const csv      = toCsv(headers, rows)
  const slug     = `${person.lastName}_${person.firstName}`.replace(/\s+/g, "_")
  const filename = `turnos_${slug}_${person.dni}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
