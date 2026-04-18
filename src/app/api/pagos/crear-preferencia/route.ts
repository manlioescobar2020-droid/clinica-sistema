import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // ── 2. Env ─────────────────────────────────────────────────────────────────
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json({ error: "Configuración de pago incompleta" }, { status: 500 })
  }

  // ── 3. Body ────────────────────────────────────────────────────────────────
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

  // ── 4. BD ──────────────────────────────────────────────────────────────────
  let appointment
  try {
    appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        payment: true,
        person: { select: { firstName: true, lastName: true, email: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
    })
  } catch (e) {
    return NextResponse.json({ error: "Error al consultar la base de datos", detail: String(e) }, { status: 500 })
  }

  if (!appointment) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  const paymentAmount = amount ?? Number(appointment.payment?.amount ?? 0)
  if (paymentAmount <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 })
  }

  // ── 5. Crear preferencia via REST ──────────────────────────────────────────
  const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
  const returnUrl = `${baseUrl}/dashboard/turnos/${appointmentId}`

  const preferenceBody = {
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
    back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
    auto_return: "approved",
    metadata: { appointment_id: appointmentId },
    notification_url: `${baseUrl}/api/pagos/webhook`,
  }

  let mpData: { id?: string; init_point?: string; sandbox_init_point?: string; message?: string }
  try {
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceBody),
    })

    mpData = await mpRes.json()

    if (!mpRes.ok) {
      return NextResponse.json(
        { error: `Mercado Pago rechazó la solicitud: ${mpData.message ?? mpRes.status}` },
        { status: 502 }
      )
    }
  } catch (e) {
    return NextResponse.json({ error: `Error de red al contactar Mercado Pago: ${String(e)}` }, { status: 502 })
  }

  if (!mpData.id || !mpData.init_point) {
    return NextResponse.json({ error: "Respuesta inesperada de Mercado Pago", detail: mpData }, { status: 502 })
  }

  // ── 6. Actualizar Payment en BD ────────────────────────────────────────────
  try {
    await prisma.payment.update({
      where: { appointmentId },
      data: { status: "PENDING", amount: paymentAmount, mpPreferenceId: mpData.id },
    })
  } catch {
    // No es fatal: la preferencia ya fue creada
  }

  const isTestToken = accessToken.startsWith("TEST-")
  const checkoutUrl = isTestToken
    ? (mpData.sandbox_init_point ?? mpData.init_point)
    : mpData.init_point

  return NextResponse.json({ checkoutUrl, preferenceId: mpData.id })
}
