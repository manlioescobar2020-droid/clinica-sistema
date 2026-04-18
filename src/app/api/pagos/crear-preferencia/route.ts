import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MercadoPagoConfig, Preference } from "mercadopago"

export async function POST(req: NextRequest) {
  console.log("[crear-preferencia] inicio")

  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session) {
    console.log("[crear-preferencia] sin sesión")
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // ── 2. Validar env ─────────────────────────────────────────────────────────
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    console.error("[crear-preferencia] MP_ACCESS_TOKEN no definido")
    return NextResponse.json(
      { error: "Configuración de pago incompleta (token ausente)" },
      { status: 500 }
    )
  }
  console.log("[crear-preferencia] token presente, primeros 10 chars:", accessToken.slice(0, 10))

  // ── 3. Parsear body ────────────────────────────────────────────────────────
  let appointmentId: string
  let amount: number | undefined

  try {
    const body = await req.json()
    appointmentId = body.appointmentId
    amount = body.amount ? Number(body.amount) : undefined
    console.log("[crear-preferencia] body:", { appointmentId, amount })
  } catch (e) {
    console.error("[crear-preferencia] body inválido:", e)
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId requerido" }, { status: 400 })
  }

  // ── 4. Buscar turno en BD ──────────────────────────────────────────────────
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
    console.error("[crear-preferencia] error BD:", e)
    return NextResponse.json({ error: "Error al consultar la base de datos" }, { status: 500 })
  }

  if (!appointment) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  const paymentAmount = amount ?? Number(appointment.payment?.amount ?? 0)
  console.log("[crear-preferencia] monto:", paymentAmount)

  if (paymentAmount <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 })
  }

  // ── 5. Crear preferencia en MP ─────────────────────────────────────────────
  const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
  const returnUrl = `${baseUrl}/dashboard/turnos/${appointmentId}`
  console.log("[crear-preferencia] returnUrl:", returnUrl)

  let mpResponse
  try {
    const mpClient = new MercadoPagoConfig({ accessToken })
    const preference = new Preference(mpClient)

    mpResponse = await preference.create({
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

    console.log("[crear-preferencia] preferencia creada:", {
      id: mpResponse.id,
      init_point: mpResponse.init_point,
      sandbox_init_point: mpResponse.sandbox_init_point,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[crear-preferencia] error MP SDK:", msg)
    return NextResponse.json(
      { error: `Error al crear preferencia en Mercado Pago: ${msg}` },
      { status: 502 }
    )
  }

  // ── 6. Actualizar Payment en BD ────────────────────────────────────────────
  try {
    await prisma.payment.update({
      where: { appointmentId },
      data: {
        status: "PENDING",
        amount: paymentAmount,
        mpPreferenceId: mpResponse.id ?? null,
      },
    })
    console.log("[crear-preferencia] payment actualizado a PENDING")
  } catch (e) {
    // No es fatal: la preferencia ya fue creada, igual devolvemos el link
    console.error("[crear-preferencia] error actualizando payment en BD:", e)
  }

  const isTestToken = accessToken.startsWith("TEST-")
  const checkoutUrl = isTestToken
    ? (mpResponse.sandbox_init_point ?? mpResponse.init_point)
    : mpResponse.init_point
  console.log("[crear-preferencia] checkoutUrl final:", checkoutUrl)

  return NextResponse.json({ checkoutUrl, preferenceId: mpResponse.id })
}
