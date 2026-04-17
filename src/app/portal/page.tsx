import type { Metadata } from "next"
import { getMyAppointments, cancelMyAppointment } from "@/lib/actions/portal"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export const metadata: Metadata = { title: "Mis Turnos" }

export default async function PortalPage() {
  const { upcoming } = await getMyAppointments()

  const statusLabels: Record<string, { label: string; color: string }> = {
    RESERVED:  { label: "Reservado",  color: "bg-yellow-100 text-yellow-800" },
    CONFIRMED: { label: "Confirmado", color: "bg-blue-100 text-blue-800" },
    ATTENDED:  { label: "Atendido",   color: "bg-green-100 text-green-800" },
  }

  const paymentLabels: Record<string, { label: string; color: string }> = {
    NO_PAYMENT:    { label: "Sin pago",      color: "bg-gray-100 text-gray-600" },
    PENDING:       { label: "Pendiente",     color: "bg-yellow-100 text-yellow-700" },
    PAID_MP:       { label: "Pagado MP",     color: "bg-green-100 text-green-700" },
    PAID_CASH:     { label: "Pagado",        color: "bg-green-100 text-green-700" },
    PAID_TRANSFER: { label: "Pagado",        color: "bg-green-100 text-green-700" },
    PAID_CARD:     { label: "Pagado",        color: "bg-green-100 text-green-700" },
    REFUNDED:      { label: "Devuelto",      color: "bg-red-100 text-red-700" },
  }

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-xl font-bold text-gray-900">Mis próximos turnos</h2>
        <p className="text-sm text-gray-500 mt-1">Turnos reservados y confirmados</p>
      </div>

      {upcoming.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-lg">No tenés turnos próximos</p>
          <p className="text-gray-400 text-sm mt-1">Contactá a la clínica para reservar uno</p>
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.map((appt) => (
            <div key={appt.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">

              {/* Fecha y hora */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 capitalize">
                    {format(new Date(appt.startTime), "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {appt.startTime.toISOString().substring(11, 16)}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusLabels[appt.status]?.color}`}>
                  {statusLabels[appt.status]?.label}
                </span>
              </div>

              <hr className="border-gray-100" />

              {/* Doctor y especialidad */}
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-gray-500">Doctor</p>
                  <p className="font-medium text-gray-900">{appt.doctor.user.name}</p>
                  {appt.doctor.specialties[0] && (
                    <p className="text-xs text-gray-400">{appt.doctor.specialties[0].specialty.name}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-gray-500">Pago</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentLabels[appt.payment?.status ?? "NO_PAYMENT"]?.color}`}>
                    {paymentLabels[appt.payment?.status ?? "NO_PAYMENT"]?.label}
                  </span>
                  {appt.payment?.amount && Number(appt.payment.amount) > 0 && (
                    <p className="text-xs text-green-600 font-bold mt-1">
                      ${Number(appt.payment.amount).toLocaleString("es-AR")}
                    </p>
                  )}
                </div>
              </div>

              {/* Cancelar */}
              {(appt.status === "RESERVED" || appt.status === "CONFIRMED") && (
                <form action={async () => {
                  "use server"
                  await cancelMyAppointment(appt.id)
                }}>
                  <button
                    type="submit"
                    className="w-full border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancelar turno
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}