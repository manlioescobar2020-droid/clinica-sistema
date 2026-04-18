import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MercadoPagoConfig, Preference } from "mercadopago"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const steps: string[] = ["handler_start"]

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    steps.push("auth_start")
    const session = await getServerSession(authOptions)
    steps.push("auth_done")

    if (!session) {
      return NextResponse.json({ error: "No autorizado", steps }, { status: 401 })
    }

    // ── 2. Env ───────────────────────────────────────────────────────────────
    steps.push("env_check")
    const accessToken = process.env.MP_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json(
        { error: "MP_ACCESS_TOKEN no definido", steps, env_keys: Object.keys(process.env).filter(k => k.startsWith("MP")) },
        { status: 500 }
      )
    }
    steps.push(`env_ok:${accessToken.slice(0, 8)}`)

    // ── 3. Body ──────────────────────────────────────────────────────────────
    steps.push("body_parse")
    let appointmentId: string
    let amount: number | undefined
    try {
      const body = await req.json()
      appointmentId = body.appointmentId
      amount = body.amount ? Number(body.amount) : undefined
    } catch (e) {
      return NextResponse.json({ error: "Body inválido", detail: String(e), steps }, { status: 400 })
    }
    steps.push(`body_ok:${appointmentId!}`)

    if (!appointmentId!) {
      return NextResponse.json({ error: "appointmentId requerido", steps }, { status: 400 })
    }

    // ── 4. BD ────────────────────────────────────────────────────────────────
    steps.push("db_query")
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
      return NextResponse.json({ error: "Error BD", detail: String(e), steps }, { status: 500 })
    }
    steps.push("db_done")

    if (!appointment) {
      return NextResponse.json({ error: "Turno no encontrado", steps }, { status: 404 })
    }

    const paymentAmount = amount ?? Number(appointment.payment?.amount ?? 0)
    if (paymentAmount <= 0) {
      return NextResponse.json({ error: "Monto debe ser mayor a 0", steps }, { status: 400 })
    }
    steps.push(`amount:${paymentAmount}`)

    // ── 5. MP ────────────────────────────────────────────────────────────────
    steps.push("mp_init")
    const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
    const returnUrl = `${baseUrl}/dashboard/turnos/${appointmentId}`

    let mpResponse
    try {
      const mpClient = new MercadoPagoConfig({ accessToken })
      const preference = new Preference(mpClient)
      steps.push("mp_create_call")
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
          back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
          auto_return: "approved",
          metadata: { appointment_id: appointmentId },
          notification_url: `${baseUrl}/api/pagos/webhook`,
        },
      })
      steps.push(`mp_done:${mpResponse.id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: `MP SDK: ${msg}`, steps }, { status: 502 })
    }

    // ── 6. Actualizar Payment ────────────────────────────────────────────────
    steps.push("db_update")
    try {
      await prisma.payment.update({
        where: { appointmentId },
        data: { status: "PENDING", amount: paymentAmount, mpPreferenceId: mpResponse.id ?? null },
      })
      steps.push("db_update_done")
    } catch (e) {
      steps.push(`db_update_error:${String(e)}`)
    }

    const isTestToken = accessToken.startsWith("TEST-")
    const checkoutUrl = isTestToken
      ? (mpResponse.sandbox_init_point ?? mpResponse.init_point)
      : mpResponse.init_point
    steps.push(`checkout_url:${checkoutUrl}`)

    return NextResponse.json({ checkoutUrl, preferenceId: mpResponse.id, steps })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? (e.stack ?? "") : ""
    return NextResponse.json({ error: msg, stack, steps }, { status: 500 })
  }
}
