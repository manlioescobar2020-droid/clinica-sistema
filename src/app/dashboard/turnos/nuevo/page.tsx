"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getDoctors } from "@/lib/actions/doctors"
import { getAvailableSlots, createAppointment } from "@/lib/actions/appointments"
import { createProspect } from "@/lib/actions/persons"

type Doctor = Awaited<ReturnType<typeof getDoctors>>[0]
type Slot = { time: string; scheduleId: string; duration: number }

export default function NuevoTurnoPage() {
  const router = useRouter()

  const [doctors, setDoctors]         = useState<Doctor[]>([])
  const [slots, setSlots]             = useState<Slot[]>([])
  const [loading, setLoading]         = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError]             = useState("")

  // Turno
  const [doctorId, setDoctorId]         = useState("")
  const [date, setDate]                 = useState("")
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [personDni, setPersonDni]       = useState("")
  const [personFound, setPersonFound]   = useState<{ id: string; name: string } | null>(null)
  const [notes, setNotes]               = useState("")

  // Prospecto inline
  const [dniNotFound, setDniNotFound]         = useState(false)
  const [showProspecto, setShowProspecto]     = useState(false)
  const [prospectoLoading, setProspectoLoading] = useState(false)
  const [prospectoError, setProspectoError]   = useState("")
  const [prospectoForm, setProspectoForm]     = useState({
    firstName: "", lastName: "", phone: "", email: "",
  })

  useEffect(() => { getDoctors().then(setDoctors) }, [])

  useEffect(() => {
    if (!doctorId || !date) return
    setLoadingSlots(true)
    setSelectedSlot(null)
    getAvailableSlots(doctorId, date)
      .then(setSlots)
      .finally(() => setLoadingSlots(false))
  }, [doctorId, date])

  async function buscarPersona() {
    if (!personDni) return
    setError("")
    setDniNotFound(false)
    setShowProspecto(false)
    setProspectoForm({ firstName: "", lastName: "", phone: "", email: "" })
    setProspectoError("")
    try {
      const res = await fetch(`/api/personas/buscar?dni=${personDni}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPersonFound({ id: data.id, name: `${data.firstName} ${data.lastName}` })
    } catch {
      setPersonFound(null)
      setDniNotFound(true)
      setError("No se encontró ninguna persona con ese DNI")
    }
  }

  async function handleCrearProspecto() {
    if (!prospectoForm.firstName || !prospectoForm.lastName) {
      setProspectoError("Nombre y apellido son obligatorios")
      return
    }
    setProspectoLoading(true)
    setProspectoError("")
    try {
      const fd = new FormData()
      fd.append("firstName", prospectoForm.firstName)
      fd.append("lastName",  prospectoForm.lastName)
      fd.append("dni",       personDni)
      fd.append("phone",     prospectoForm.phone)
      fd.append("email",     prospectoForm.email)
      const result = await createProspect(fd)
      setPersonFound({ id: result.personId, name: result.fullName })
      setShowProspecto(false)
      setDniNotFound(false)
      setError("")
    } catch (e) {
      setProspectoError(e instanceof Error ? e.message : "Error al crear el prospecto")
    } finally {
      setProspectoLoading(false)
    }
  }

  async function handleSubmit() {
    if (!personFound || !doctorId || !date || !selectedSlot) {
      setError("Completá todos los campos")
      return
    }
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("personId",   personFound.id)
      formData.append("doctorId",   doctorId)
      formData.append("scheduleId", selectedSlot.scheduleId)
      formData.append("date",       date)
      formData.append("time",       selectedSlot.time)
      formData.append("duration",   selectedSlot.duration.toString())
      formData.append("notes",      notes)
      const result = await createAppointment(formData)
      if (result.success) router.push("/dashboard/turnos")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el turno")
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Turno</h1>
        <p className="text-sm text-gray-500 mt-1">Completá los datos para reservar un turno</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">

        {/* Buscar paciente */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Paciente / Prospecto</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ingresá el DNI"
              value={personDni}
              onChange={(e) => {
                setPersonDni(e.target.value)
                setPersonFound(null)
                setDniNotFound(false)
                setShowProspecto(false)
                setError("")
              }}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={buscarPersona}
              type="button"
              className="bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Buscar
            </button>
          </div>

          {/* Encontrado */}
          {personFound && (
            <p className="text-sm text-green-600 font-medium">✅ {personFound.name}</p>
          )}

          {/* No encontrado → ofrecer crear */}
          {dniNotFound && !showProspecto && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-500">DNI no encontrado.</p>
              <button
                type="button"
                onClick={() => { setShowProspecto(true); setError("") }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
              >
                + Crear como prospecto
              </button>
            </div>
          )}

          {/* Formulario inline prospecto */}
          {showProspecto && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-blue-800">
                  Nuevo prospecto — DNI {personDni}
                </p>
                <button
                  type="button"
                  onClick={() => { setShowProspecto(false); setProspectoError("") }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    placeholder="Ej: Juan"
                    value={prospectoForm.firstName}
                    onChange={(e) => setProspectoForm(p => ({ ...p, firstName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido *</label>
                  <input
                    type="text"
                    placeholder="Ej: García"
                    value={prospectoForm.lastName}
                    onChange={(e) => setProspectoForm(p => ({ ...p, lastName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    placeholder="Ej: 1134567890"
                    value={prospectoForm.phone}
                    onChange={(e) => setProspectoForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Ej: juan@mail.com"
                    value={prospectoForm.email}
                    onChange={(e) => setProspectoForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              {prospectoError && (
                <p className="text-xs text-red-600">{prospectoError}</p>
              )}

              <button
                type="button"
                onClick={handleCrearProspecto}
                disabled={prospectoLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {prospectoLoading ? "Creando..." : "Crear prospecto y continuar"}
              </button>
            </div>
          )}
        </div>

        {/* Doctor */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Doctor</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccioná un doctor</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.user.name}</option>
            ))}
          </select>
        </div>

        {/* Fecha */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Slots disponibles */}
        {doctorId && date && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Horario disponible</label>
            {loadingSlots ? (
              <p className="text-sm text-gray-400">Cargando horarios...</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-red-500">No hay horarios disponibles para este día</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`px-3 py-2 rounded-lg text-sm font-mono font-medium border transition-colors ${
                      selectedSlot?.time === slot.time
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notas */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Notas <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Motivo de consulta, indicaciones, etc."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Error general */}
        {error && !dniNotFound && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Guardando..." : "Reservar turno"}
          </button>
        </div>
      </div>
    </div>
  )
}
