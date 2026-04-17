import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PaymentStatus, RoleName } from "@prisma/client"
import { toCsv } from "@/lib/csv"

const PAID_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID_CASH,
  PaymentStatus.PAID_TRANSFER,
  PaymentStatus.PAID_CARD,
  PaymentStatus.PAID_MP,
]

const METODO_LABELS: Record<string, string> = {
  PAID_CASH:     "Efectivo",
  PAID_TRANSFER: "Transferencia",
  PAID_CARD:     "Tarjeta",
  PAID_MP:       "MercadoPago",
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new NextResponse("No autorizado", { status: 401 })
  }

  const role = session.user.role as RoleName
  if (role !== RoleName.ADMIN && role !== RoleName.SECRETARY) {
    return new NextResponse("Acceso denegado", { status: 403 })
  }

  const params   = request.nextUrl.searchParams
  const desde    = params.get("desde") || ""
  const hasta    = params.get("hasta") || ""
  const doctorId = params.get("doctorId") || ""

  if (!desde || !hasta) {
    return new NextResponse("Parámetros desde/hasta requeridos", { status: 400 })
  }

  const desdeDate = new Date(`${desde}T00:00:00.000Z`)
  const hastaDate = new Date(`${hasta}T23:59:59.999Z`)

  const pagos = await prisma.payment.findMany({
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
          person: { select: { firstName: true, lastName: true, dni: true } },
          doctor: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { appointment: { startTime: "asc" } },
  })

  const headers = ["Fecha", "Paciente", "DNI", "Doctor", "Método de pago", "Monto"]

  const rows = pagos.map((p) => {
    const iso   = p.appointment.startTime.toISOString().substring(0, 10)
    const [y, m, d] = iso.split("-")
    return [
      `${d}/${m}/${y}`,
      `${p.appointment.person.firstName} ${p.appointment.person.lastName}`,
      p.appointment.person.dni,
      p.appointment.doctor.user.name,
      METODO_LABELS[p.status] ?? p.status,
      Number(p.amount).toFixed(2),
    ]
  })

  const csv      = toCsv(headers, rows)
  const filename = `reportes_${desde}_${hasta}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
