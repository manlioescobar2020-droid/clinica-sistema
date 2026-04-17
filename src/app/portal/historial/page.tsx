import type { Metadata } from "next"
import { getMyAppointments } from "@/lib/actions/portal"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export const metadata: Metadata = { title: "Mi Historial" }

export default async function HistorialPage() {
  const { past } = await getMyAppointments()

  const statusLabels: Record<string, { label: string; color: string }> = {
    ATTENDED:          { label: "Atendido",         color: "bg-green-100 text-green-800" },
    CANCELLED_PATIENT: { label: "Cancelado",        color: "bg-red-100 text-red-800" },
    CANCELLED_CLINIC:  { label: "Cancel. Clínica",  color: "bg-orange-100 text-orange-800" },
    NO_SHOW:           { label: "No asistió",       color: "bg-gray-100 text-gray-800" },
  }

  const paymentLabels: Record<string, { label: string; color: string }> = {
    NO_PAYMENT:    { label: "Sin pago",  color: "bg-gray-100 text-gray-600" },
    PAID_MP:       { label: "Pagado",    color: "bg-green-100 text-green-700" },
    PAID_CASH:     { label: "Pagado",    color: "bg-green-100 text-green-700" },
    PAID_TRANSFER: { label: "Pagado",    color: "bg-green-100 text-green-700" },
    PAID_CARD:     { label: "Pagado",    color: "bg-green-100 text-green-700" },
    REFUNDED:      { label: "Devuelto",  color: "bg-red-100 text-red-700" },
  }

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-xl font-bold text-gray-900">Historial de turnos</h2>
        <p className="text-sm text-gray-500 mt-1">Últimos 20 turnos</p>
      </div>

      {past.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-lg">No tenés turnos anteriores</p>
        </div>
      ) : (
        <div className="space-y-3">
          {past.map((appt) => (
            <div key={appt.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">

                <div>
                  <p className="font-medium text-gray-900 capitalize">
                    {format(new Date(appt.startTime), "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {appt.startTime.toISOString().substring(11, 16)} — {appt.doctor.user.name}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    {appt.payment && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentLabels[appt.payment.status]?.color}`}>
                        {paymentLabels[appt.payment.status]?.label}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusLabels[appt.status]?.color}`}>
                      {statusLabels[appt.status]?.label}
                    </span>
                  </div>
                  {appt.payment && Number(appt.payment.amount) > 0 && (
                    <p className="text-xs font-bold text-green-600">
                      ${Number(appt.payment.amount).toLocaleString("es-AR")}
                    </p>
                  )}
                </div>

              </div>

              {appt.cancelReason && (
                <p className="text-xs text-gray-400 mt-2 italic">{appt.cancelReason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}