"use client"

import { useEffect, useState } from "react"
import { getAgendaBlocks, createAgendaBlock, deleteAgendaBlock } from "@/lib/actions/appointments"
import { useParams } from "next/navigation"
import { getDoctorById, getDoctorSchedules, upsertSchedule, deleteSchedule } from "@/lib/actions/doctors"

type Doctor = Awaited<ReturnType<typeof getDoctorById>>
type Schedules = Awaited<ReturnType<typeof getDoctorSchedules>>
type AgendaBlocks = Awaited<ReturnType<typeof getAgendaBlocks>>
import Link from "next/link"

const DAYS = [
  { value: "MONDAY", label: "Lunes" },
  { value: "TUESDAY", label: "Martes" },
  { value: "WEDNESDAY", label: "Miércoles" },
  { value: "THURSDAY", label: "Jueves" },
  { value: "FRIDAY", label: "Viernes" },
  { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" },
]

const DURATIONS = [15, 20, 30, 45, 60]

export default function AgendaPage() {
  const params = useParams()
  const id = params.id as string

  const [doctor, setDoctor] = useState<Doctor>(null)
  const [schedules, setSchedules] = useState<Schedules>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [selectedDay, setSelectedDay] = useState("MONDAY")
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("13:00")
  const [slotDuration, setSlotDuration] = useState(30)

  const [blocks, setBlocks] = useState<AgendaBlocks>([])
  const [blockType, setBlockType] = useState("full")
  const [blockDate, setBlockDate] = useState("")
  const [blockStart, setBlockStart] = useState("09:00")
  const [blockEnd, setBlockEnd] = useState("13:00")
  const [blockReason, setBlockReason] = useState("")
  const [savingBlock, setSavingBlock] = useState(false)
  const [blockError, setBlockError] = useState("")
  const [blockSuccess, setBlockSuccess] = useState("")

  useEffect(() => {
    async function load() {
      const [docRes, schedsRes, blksRes] = await Promise.allSettled([
        getDoctorById(id),
        getDoctorSchedules(id),
        getAgendaBlocks(id),
      ])
      if (docRes.status === "fulfilled") setDoctor(docRes.value)
      if (schedsRes.status === "fulfilled") setSchedules(schedsRes.value)
      if (blksRes.status === "fulfilled") setBlocks(blksRes.value)
      setLoading(false)
    }
    load()
  }, [id])

  async function handleAddSchedule(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("dayOfWeek", selectedDay)
      formData.set("startTime", startTime)
      formData.set("endTime", endTime)
      formData.set("slotDuration", slotDuration.toString())
      await upsertSchedule(id, formData)
      const updated = await getDoctorSchedules(id)
      setSchedules(updated)
    } catch (err: any) {
      setError(err.message || "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(scheduleId: string) {
    if (!confirm("¿Eliminar esta franja horaria?")) return
    try {
      await deleteSchedule(scheduleId, id)
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
    } catch (err: any) {
      setError(err.message || "Error al eliminar")
    }
  }

  async function handleCreateBlock(e: React.FormEvent) {
    e.preventDefault()
    setSavingBlock(true)
    setBlockError("")
    setBlockSuccess("")
    try {
      const formData = new FormData()
      formData.set("date", blockDate)
      formData.set("type", blockType)
      formData.set("reason", blockReason)
      if (blockType === "partial") {
        formData.set("startTime", blockStart)
        formData.set("endTime", blockEnd)
      }
      const result = await createAgendaBlock(id, formData)
      const updated = await getAgendaBlocks(id)
      setBlocks(updated)
      setBlockReason("")
      setBlockDate("")
      setBlockSuccess(
        result.cancelledCount > 0
          ? `✅ Agenda cerrada. Se cancelaron ${result.cancelledCount} turno(s) automáticamente.`
          : "✅ Agenda cerrada. No había turnos en ese horario."
      )
    } catch (err: any) {
      setBlockError(err.message || "Error al cerrar agenda")
    } finally {
      setSavingBlock(false)
    }
  }

  async function handleDeleteBlock(blockId: string) {
    if (!confirm("¿Reabrir esta franja?")) return
    try {
      await deleteAgendaBlock(blockId, id)
      setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    } catch (err: any) {
      setBlockError(err.message || "Error al eliminar")
    }
  }

  function getDayLabel(day: string) {
    return DAYS.find((d) => d.value === day)?.label || day
  }

  function calcSlots(start: string, end: string, duration: number) {
    const [sh, sm] = start.split(":").map(Number)
    const [eh, em] = end.split(":").map(Number)
    const totalMin = (eh * 60 + em) - (sh * 60 + sm)
    return Math.floor(totalMin / duration)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">

        <div className="mb-8">
          <Link href={`/dashboard/doctores/${id}`} className="text-sm text-gray-500 hover:underline">
            ← Volver al doctor
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Agenda de {doctor?.user.name}
          </h1>
          <p className="text-gray-500 mt-1">Configurá los días y horarios de atención</p>
        </div>

        <div className="grid gap-6">

          {/* Agregar franja */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-700 mb-4">Agregar franja horaria</h2>
            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Día</label>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DAYS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración del turno</label>
                  <select
                    value={slotDuration}
                    onChange={(e) => setSlotDuration(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>{d} minutos</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {startTime && endTime && (
                <p className="text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
                  💡 Esta franja genera <strong>{calcSlots(startTime, endTime, slotDuration)} turnos</strong> de {slotDuration} min cada uno
                </p>
              )}

              {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
              >
                {saving ? "Guardando..." : "+ Agregar franja"}
              </button>
            </form>
          </div>

          {/* Lista de franjas */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-700 mb-4">Franjas configuradas ({schedules.length})</h2>
            {schedules.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No hay franjas configuradas todavía</p>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-900 w-24">{getDayLabel(schedule.dayOfWeek)}</span>
                      <span className="text-gray-600 text-sm">{schedule.startTime} — {schedule.endTime}</span>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">{schedule.slotDuration} min / turno</span>
                      <span className="text-xs text-gray-400">{calcSlots(schedule.startTime, schedule.endTime, schedule.slotDuration)} turnos</span>
                    </div>
                    <button onClick={() => handleDelete(schedule.id)} className="text-sm text-red-500 hover:underline">
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cierre de Agenda */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-700">🔒 Cierre de Agenda</h2>

            <form onSubmit={handleCreateBlock} className="space-y-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setBlockType("full")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    blockType === "full"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-red-400"
                  }`}
                >
                  Día completo
                </button>
                <button
                  type="button"
                  onClick={() => setBlockType("partial")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    blockType === "partial"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                  }`}
                >
                  Franja específica
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Fecha</label>
                <input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  required
                />
              </div>

              {blockType === "partial" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Desde</label>
                    <input
                      type="time"
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Hasta</label>
                    <input
                      type="time"
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Motivo</label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Ej: Congreso médico, Vacaciones..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  required
                />
              </div>

              {blockError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{blockError}</p>}
              {blockSuccess && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{blockSuccess}</p>}

              <button
                type="submit"
                disabled={savingBlock}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {savingBlock ? "Cerrando..." : "🔒 Cerrar agenda"}
              </button>
            </form>

            {blocks.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-gray-500">Cierres programados</p>
                {blocks.map((block) => (
                  <div key={block.id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        {new Date(block.date).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                        {block.startTime && ` — ${block.startTime} a ${block.endTime}`}
                        {!block.startTime && " — Día completo"}
                      </p>
                      <p className="text-xs text-red-600">{block.reason}</p>
                    </div>
                    <button onClick={() => handleDeleteBlock(block.id)} className="text-xs text-red-500 hover:underline ml-3">
                      Reabrir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}