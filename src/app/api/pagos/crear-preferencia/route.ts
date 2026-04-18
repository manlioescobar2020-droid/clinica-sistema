import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MercadoPagoConfig, Preference } from "mercadopago"

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  let appointmentId: string
  let amount: number | undefined

  try {
    const body = await req.json()
    appointmentId = body.appointmentId
    amount = body.amount ? Number(body.amount) : undefined
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId requerido" }, { status: 400 })
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      payment: true,
      person: { select: { firstName: true, lastName: true, email: true } },
      doctor: { include: { user: { select: { name: true } } } },
    },
  })

  if (!appointment) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  const paymentAmount = amount ?? Number(appointment.payment?.amount ?? 0)

  if (paymentAmount <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 })
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  const returnUrl = `${baseUrl}/dashboard/turnos/${appointmentId}`

  const preference = new Preference(mpClient)

  const mpResponse = await preference.create({
    body: {
      items: [
        {
          id: appointmentId,
          title: `Consulta médica - Dr. ${appointment.doctor.user.name}`,
          quantity: 1,
          unit_price: paymentAmount,
          currency_id: "ARS",
        },
      ],
      payer: {
        name: appointment.person.firstName,
        surname: appointment.person.lastName,
        ...(appointment.person.email ? { email: appointment.person.email } : {}),
      },
      back_urls: {
        success: returnUrl,
        failure: returnUrl,
        pending: returnUrl,
      },
      auto_return: "approved",
      metadata: { appointment_id: appointmentId },
      notification_url: `${baseUrl}/api/pagos/webhook`,
    },
  })

  await prisma.payment.update({
    where: { appointmentId },
    data: {
      status: "PENDING",
      amount: paymentAmount,
      mpPreferenceId: mpResponse.id ?? null,
    },
  })

  // sandbox_init_point for test credentials, init_point for production
  const checkoutUrl = mpResponse.sandbox_init_point ?? mpResponse.init_point

  return NextResponse.json({ checkoutUrl, preferenceId: mpResponse.id })
}
