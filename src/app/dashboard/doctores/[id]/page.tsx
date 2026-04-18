"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getDoctorById, updateDoctor, deleteDoctor, getSpecialties } from "@/lib/actions/doctors"

type Doctor = Awaited<ReturnType<typeof getDoctorById>>
import Link from "next/link"

export default function EditarDoctorPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState("")
  const [especialidades, setEspecialidades] = useState<{ id: string; name: string }[]>([])
  const [selectedEspecialidades, setSelectedEspecialidades] = useState<string[]>([])
  const [doctor, setDoctor] = useState<Doctor>(null)

  useEffect(() => {
    async function load() {
      const [doc, esps] = await Promise.all([getDoctorById(id), getSpecialties()])
      if (!doc) {
        router.push("/dashboard/doctores")
        return
      }
      setDoctor(doc)
      setSelectedEspecialidades(doc.specialties.map((ds) => ds.specialtyId))
      setEspecialidades(esps)
      setLoadingData(false)
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const formData = new FormData(e.currentTarget)
      selectedEspecialidades.forEach((id) => formData.append("specialtyIds", id))
      await updateDoctor(id, formData)
      router.push("/dashboard/doctores")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar")
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm("¿Seguro que querés desactivar este doctor?")) return
    try {
      await deleteDoctor(id)
      router.push("/dashboard/doctores")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar")
    }
  }

  function toggleEspecialidad(espId: string) {
    setSelectedEspecialidades((prev) =>
      prev.includes(espId) ? prev.filter((e) => e !== espId) : [...prev, espId]
    )
  }

  if (loadingData || !doctor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/dashboard/doctores" className="text-sm text-gray-500 hover:underline">
              ← Volver a Doctores
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">Editar Doctor</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/doctores/${id}/agenda`}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              📅 Configurar agenda
            </Link>
            <button
              onClick={handleDelete}
              className="text-sm text-red-600 hover:underline font-medium"
            >
              Desactivar doctor
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
          <div>
            <h2 className="font-semibold text-gray-700 mb-4">Datos personales</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo *
                </label>
                <input
                  name="name"
                  required
                  defaultValue={doctor.user.name}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={doctor.user.email}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Matrícula
                  </label>
                  <input
                    name="licenseNumber"
                    defaultValue={doctor.licenseNumber || ""}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    name="phone"
                    defaultValue={doctor.phone || ""}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Biografía
                </label>
                <textarea
                  name="bio"
                  rows={3}
                  defaultValue={doctor.bio || ""}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Especialidades */}
          <div>
            <h2 className="font-semibold text-gray-700 mb-4">Especialidades</h2>
            <div className="flex flex-wrap gap-2">
              {especialidades.map((esp) => (
                <button
                  key={esp.id}
                  type="button"
                  onClick={() => toggleEspecialidad(esp.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    selectedEspecialidades.includes(esp.id)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {esp.name}
                </button>
              ))}
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
      </div>
    </div>
  )
}