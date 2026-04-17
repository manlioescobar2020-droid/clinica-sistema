import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAppointmentById, updateAppointmentStatus, cancelAppointment, registerManualPayment, registerRefund } from "@/lib/actions/appointments"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { RoleName, AppointmentStatus } from "@prisma/client"

export const metadata: Metadata = { title: "Detalle de Turno" }

export default async function TurnoDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const role = session.user.role as RoleName
  const appt = await getAppointmentById(params.id)
  if (!appt) notFound()

  const statusLabels: Record<string, { label: string; color: string }> = {
    RESERVED:          { label: "Reservado",        color: "bg-yellow-100 text-yellow-800" },
    CONFIRMED:         { label: "Confirmado",        color: "bg-blue-100 text-blue-800" },
    ATTENDED:          { label: "Atendido",          color: "bg-green-100 text-green-800" },
    CANCELLED_PATIENT: { label: "Cancel. Paciente",  color: "bg-red-100 text-red-800" },
    CANCELLED_CLINIC:  { label: "Cancel. Clínica",   color: "bg-orange-100 text-orange-800" },
    NO_SHOW:           { label: "No asistió",        color: "bg-gray-100 text-gray-800" },
  }

  const paymentLabels: Record<string, { label: string; color: string }> = {
    NO_PAYMENT:      { label: "Sin pago",       color: "bg-gray-100 text-gray-600" },
    PENDING:         { label: "Pendiente",      color: "bg-yellow-100 text-yellow-700" },
    PAID_MP:         { label: "Mercado Pago",   color: "bg-blue-100 text-blue-700" },
    PAID_CASH:       { label: "Efectivo",       color: "bg-green-100 text-green-700" },
    PAID_TRANSFER:   { label: "Transferencia",  color: "bg-green-100 text-green-700" },
    PAID_CARD:       { label: "Tarjeta",        color: "bg-green-100 text-green-700" },
    REFUNDED:        { label: "Devuelto",       color: "bg-red-100 text-red-700" },
  }

  const isCancelled = ["CANCELLED_PATIENT", "CANCELLED_CLINIC"].includes(appt.status)
  const isClosed = ["ATTENDED", "NO_SHOW"].includes(appt.status)
  const isPaid = ["PAID_CASH", "PAID_MP", "PAID_TRANSFER", "PAID_CARD"].includes(appt.payment?.status ?? "")
  const isRefunded = appt.payment?.status === "REFUNDED"

  const canMarkAttended = [RoleName.ADMIN, RoleName.DOCTOR, RoleName.SECRETARY].includes(role)
  const canCancel = [RoleName.ADMIN, RoleName.SECRETARY].includes(role)
  const canRegisterPayment = [RoleName.ADMIN, RoleName.SECRETARY].includes(role)

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/turnos" className="text-gray-400 hover:text-gray-600 transition-colors">
          ← Volver
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Detalle del Turno</h1>
          <p className="text-sm text-gray-500 mt-1">
            {format(new Date(appt.startTime), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* Info principal */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Estado del turno</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusLabels[appt.status]?.color}`}>
            {statusLabels[appt.status]?.label}
          </span>
        </div>
        <hr className="border-gray-100" />

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Horario</span>
          <span className="font-mono font-medium text-gray-900">
            {appt.startTime.toISOString().substring(11, 16)} → {appt.endTime.toISOString().substring(11, 16)}
          </span>
        </div>
        <hr className="border-gray-100" />

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Paciente</span>
          <div className="text-right">
            <p className="font-medium text-gray-900">{appt.person.firstName} {appt.person.lastName}</p>
            <p className="text-xs text-gray-500">DNI {appt.person.dni}</p>
            {appt.person.phone && (
              <a
                href={`https://wa.me/${appt.person.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 hover:text-green-800 font-medium"
              >
                📱 WhatsApp {appt.person.phone}
              </a>
            )}
          </div>
        </div>
        <hr className="border-gray-100" />

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Doctor</span>
          <span className="font-medium text-gray-900">{appt.doctor.user.name}</span>
        </div>
        <hr className="border-gray-100" />

        {/* Pago */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Estado del pago</span>
          <div className="text-right space-y-1">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${paymentLabels[appt.payment?.status ?? "NO_PAYMENT"]?.color}`}>
              {paymentLabels[appt.payment?.status ?? "NO_PAYMENT"]?.label}
            </span>
            {isPaid && appt.payment?.amount && Number(appt.payment.amount) > 0 && (
              <p className="text-sm font-bold text-green-600">
                ${Number(appt.payment.amount).toLocaleString("es-AR")}
              </p>
            )}
            {isRefunded && appt.payment?.refundReason && (
              <p className="text-xs text-red-500">{appt.payment.refundReason}</p>
            )}
          </div>
        </div>

        {appt.notes && (
          <>
            <hr className="border-gray-100" />
            <div className="space-y-1">
              <span className="text-sm font-medium text-gray-500">Notas</span>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{appt.notes}</p>
            </div>
          </>
        )}

        {appt.cancelReason && (
          <>
            <hr className="border-gray-100" />
            <div className="space-y-1">
              <span className="text-sm font-medium text-gray-500">Motivo cancelación</span>
              <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{appt.cancelReason}</p>
            </div>
          </>
        )}
      </div>

      {/* Acciones del turno */}
      {!isCancelled && !isClosed && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Acciones del turno</h2>

          {canMarkAttended && (
            <form action={async () => {
              "use server"
              await updateAppointmentStatus(appt.id, AppointmentStatus.ATTENDED)
            }}>
              <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                ✅ Marcar como Atendido
              </button>
            </form>
          )}

          {canMarkAttended && (
            <form action={async () => {
              "use server"
              await updateAppointmentStatus(appt.id, AppointmentStatus.NO_SHOW)
            }}>
              <button type="submit" className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                ❌ No asistió
              </button>
            </form>
          )}

          {canCancel && (
            <form action={async (formData: FormData) => {
              "use server"
              const reason = formData.get("reason") as string
              await cancelAppointment(appt.id, "CLINIC", reason)
            }} className="space-y-2">
              <input
                name="reason"
                placeholder="Motivo de cancelación (opcional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button type="submit" className="w-full bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Cancelar turno (clínica)
              </button>
            </form>
          )}
        </div>
      )}

      {/* Registrar pago manual */}
      {canRegisterPayment && !isPaid && !isRefunded && !isCancelled && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">💰 Registrar pago</h2>
          <form action={async (formData: FormData) => {
            "use server"
            await registerManualPayment(appt.id, formData)
          }} className="space-y-3">

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Método de pago</label>
              <select
                name="method"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PAID_CASH">💵 Efectivo</option>
                <option value="PAID_TRANSFER">🏦 Transferencia</option>
                <option value="PAID_CARD">💳 Tarjeta débito/crédito</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Monto ($)</label>
              <input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Confirmar pago
            </button>
          </form>
        </div>
      )}

      {/* Registrar devolución */}
      {canRegisterPayment && isPaid && !isRefunded && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">↩️ Registrar devolución</h2>
          <form action={async (formData: FormData) => {
            "use server"
            const reason = formData.get("reason") as string
            await registerRefund(appt.id, reason)
          }} className="space-y-3">
            <input
              name="reason"
              placeholder="Motivo de la devolución (opcional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button type="submit" className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Registrar devolución
            </button>
          </form>
        </div>
      )}

      {/* Link a persona */}
      <div className="text-center">
        <Link href={`/dashboard/personas/${appt.personId}`} className="text-sm text-blue-600 hover:text-blue-800">
          Ver perfil completo del paciente →
        </Link>
      </div>

    </div>
  )
}