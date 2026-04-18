import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { MercadoPagoConfig, Payment } from "mercadopago"

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

// Siempre 200 — MP deja de reintentar solo con 200
const ok = () => NextResponse.json({ received: true }, { status: 200 })

// MP verifica el endpoint con GET antes de enviar notificaciones
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>

  try {
    body = await req.json()
  } catch {
    // Body inválido: devolver 200 igual para que MP no reintente
    return ok()
  }

  // Solo procesar notificaciones de tipo "payment"
  if (body.type !== "payment" || !body.data) return ok()

  const paymentId = (body.data as Record<string, unknown>)?.id
  if (!paymentId) return ok()

  try {
    const mpPayment = new Payment(mpClient)
    const paymentData = await mpPayment.get({ id: String(paymentId) })

    const mpStatus = paymentData.status

    // Solo actuar sobre estados finales: approved y rejected
    if (mpStatus !== "approved" && mpStatus !== "rejected") return ok()

    // MP convierte camelCase a snake_case en metadata
    const appointmentId = (
      paymentData.metadata as Record<string, string> | undefined
    )?.appointment_id

    if (!appointmentId) {
      console.error("[webhook-mp] appointment_id ausente en metadata", paymentData.metadata)
      return ok()
    }

    if (mpStatus === "approved") {
      await prisma.payment.update({
        where: { appointmentId },
        data: {
          status: "PAID_MP",
          mpPaymentId: String(paymentId),
          amount: paymentData.transaction_amount ?? undefined,
          mpRawWebhook: body as Parameters<typeof prisma.payment.update>[0]["data"]["mpRawWebhook"],
        },
      })
    } else {
      // rejected: revertir a NO_PAYMENT para que el turno pueda volver a intentar
      await prisma.payment.update({
        where: { appointmentId },
        data: {
          status: "NO_PAYMENT",
          mpPaymentId: String(paymentId),
          mpRawWebhook: body as Parameters<typeof prisma.payment.update>[0]["data"]["mpRawWebhook"],
        },
      })
    }
  } catch (error) {
    console.error("[webhook-mp] error:", error)
    // Devolver 200 para que MP no reintente indefinidamente
  }

  return ok()
}
