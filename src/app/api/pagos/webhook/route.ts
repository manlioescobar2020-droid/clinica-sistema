import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { MercadoPagoConfig, Payment } from "mercadopago"

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

// MP verifica el endpoint con GET antes de enviar notificaciones
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  // Solo procesar notificaciones de tipo "payment"
  if (body.type !== "payment" || !body.data) {
    return NextResponse.json({ received: true })
  }

  const paymentId = (body.data as Record<string, unknown>)?.id
  if (!paymentId) return NextResponse.json({ received: true })

  try {
    const mpPayment = new Payment(mpClient)
    const paymentData = await mpPayment.get({ id: String(paymentId) })

    if (paymentData.status !== "approved") {
      return NextResponse.json({ received: true })
    }

    // MP convierte camelCase a snake_case en metadata
    const appointmentId =
      (paymentData.metadata as Record<string, string> | undefined)?.appointment_id

    if (!appointmentId) {
      console.error("Webhook MP: appointment_id no encontrado en metadata", paymentData.metadata)
      return NextResponse.json({ received: true })
    }

    await prisma.payment.update({
      where: { appointmentId },
      data: {
        status: "PAID_MP",
        mpPaymentId: String(paymentId),
        mpRawWebhook: body as Parameters<typeof prisma.payment.update>[0]["data"]["mpRawWebhook"],
        amount: paymentData.transaction_amount ?? undefined,
      },
    })
  } catch (error) {
    console.error("Webhook MP error:", error)
    // Devolver 200 para que MP no reintente indefinidamente
    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}
