"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getPersonById, updatePerson, changePersonStatus, deletePerson } from "@/lib/actions/persons"
import Link from "next/link"
import { PersonStatus } from "@prisma/client"

type Persona = Awaited<ReturnType<typeof getPersonById>>

const STATUS_LABELS: Record<PersonStatus, string> = {
  PROSPECT: "Prospecto",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  ARCHIVED: "Archivado",
}

const STATUS_COLORS: Record<PersonStatus, string> = {
  PROSPECT: "bg-yellow-50 text-yellow-600",
  ACTIVE: "bg-green-50 text-green-600",
  INACTIVE: "bg-gray-50 text-gray-600",
  ARCHIVED: "bg-red-50 text-red-600",
}

const APT_STATUS_LABELS: Record<string, string> = {
  RESERVED:          "Reservado",
  CONFIRMED:         "Confirmado",
  ATTENDED:          "Atendido",
  CANCELLED_PATIENT: "Cancel. Paciente",
  CANCELLED_CLINIC:  "Cancel. Clínica",
  NO_SHOW:           "No asistió",
}

const APT_STATUS_COLORS: Record<string, string> = {
  RESERVED:          "bg-yellow-100 text-yellow-800",
  CONFIRMED:         "bg-blue-100 text-blue-800",
  ATTENDED:          "bg-green-100 text-green-800",
  CANCELLED_PATIENT: "bg-red-100 text-red-800",
  CANCELLED_CLINIC:  "bg-orange-100 text-orange-800",
  NO_SHOW:           "bg-gray-100 text-gray-800",
}

export default function EditarPersonaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState("")
  const [persona, setPersona] = useState<Persona>(null)

  useEffect(() => {
    getPersonById(id).then((p) => {
      if (!p) {
        router.push("/dashboard/personas")
        return
      }
      setPersona(p)
      setLoadingData(false)
    })
  }, [id])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const formData = new FormData(e.currentTarget)
      await updatePerson(id, formData)
      router.push("/dashboard/personas")
    } catch (err: any) {
      setError(err.message || "Error al actualizar")
      setLoading(false)
    }
  }

  async function handleStatusChange(status: PersonStatus) {
    try {
      await changePersonStatus(id, status)
      setPersona((prev) => prev ? { ...prev, status } : prev)
    } catch (err: any) {
      setError(err.message || "Error al cambiar estado")
    }
  }

  async function handleDelete() {
    if (!confirm("¿Seguro que querés archivar esta persona?")) return
    try {
      await deletePerson(id)
      router.push("/dashboard/personas")
    } catch (err: any) {
      setError(err.message || "Error al archivar")
    }
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/dashboard/personas" className="text-sm text-gray-500 hover:underline">
              ← Volver a Personas
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              {persona.lastName}, {persona.firstName}
            </h1>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_COLORS[persona.status as PersonStatus]}`}>
              {STATUS_LABELS[persona.status as PersonStatus]}
            </span>
          </div>
          <button
            onClick={handleDelete}
            className="text-sm text-red-600 hover:underline font-medium"
          >
            Archivar persona
          </button>
        </div>

        <div className="grid gap-6">
          {/* Cambiar estado */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-700 mb-4">Estado</h2>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => handleStatusChange(value as PersonStatus)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    persona.status === value
                      ? STATUS_COLORS[value as PersonStatus]
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Formulario editar */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
            <h2 className="font-semibold text-gray-700">Datos personales</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    name="firstName"
                    required
                    defaultValue={persona.firstName}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                  <input
                    name="lastName"
                    required
                    defaultValue={persona.lastName}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DNI *</label>
                <input
                  name="dni"
                  required
                  defaultValue={persona.dni}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={persona.email || ""}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  name="phone"
                  defaultValue={persona.phone || ""}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de nacimiento
                </label>
                <input
                  name="birthDate"
                  type="date"
                  defaultValue={
                    persona.birthDate
                      ? new Date(persona.birthDate).toISOString().split("T")[0]
                      : ""
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={persona.notes || ""}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>

          {/* Historial de turnos */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">
                Últimos turnos ({persona.appointments.length})
              </h2>
              {persona.appointments.length > 0 && (
                <a
                  href={`/api/export/persona-turnos/${id}`}
                  className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium px-3 py-1.5 rounded-lg transition text-xs"
                >
                  ↓ Exportar CSV
                </a>
              )}
            </div>
            {persona.appointments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin turnos registrados</p>
            ) : (
              <div className="divide-y divide-gray-100 -mx-6 -mb-6">
                {persona.appointments.map((apt) => (
                  <Link
                    key={apt.id}
                    href={`/dashboard/turnos/${apt.id}`}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[2.5rem]">
                        <p className="font-mono text-sm font-semibold text-gray-900">
                          {new Date(apt.startTime).toISOString().substring(11, 16)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {apt.doctor.user.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(apt.startTime).toLocaleDateString("es-AR", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${APT_STATUS_COLORS[apt.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {APT_STATUS_LABELS[apt.status] ?? apt.status}
                      </span>
                      <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}