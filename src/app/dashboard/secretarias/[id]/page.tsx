"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getSecretaryById, updateSecretary, deleteSecretary } from "@/lib/actions/secretaries"
import { getDoctors } from "@/lib/actions/doctors"

type Secretary = Awaited<ReturnType<typeof getSecretaryById>>
type Doctors = Awaited<ReturnType<typeof getDoctors>>
import Link from "next/link"

export default function EditarSecretariaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState("")
  const [doctores, setDoctores] = useState<Doctors>([])
  const [selectedDoctores, setSelectedDoctores] = useState<string[]>([])
  const [secretary, setSecretary] = useState<Secretary>(null)

  useEffect(() => {
    async function load() {
      const [sec, docs] = await Promise.all([
        getSecretaryById(id),
        getDoctors(),
      ])
      if (!sec) {
        router.push("/dashboard/secretarias")
        return
      }
      setSecretary(sec)
      setSelectedDoctores(sec.secretaryDoctors.map((sd) => sd.doctorId))
      setDoctores(docs)
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
      selectedDoctores.forEach((id) => formData.append("doctorIds", id))
      await updateSecretary(id, formData)
      router.push("/dashboard/secretarias")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar")
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm("¿Seguro que querés desactivar esta secretaria?")) return
    try {
      await deleteSecretary(id)
      router.push("/dashboard/secretarias")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar")
    }
  }

  function toggleDoctor(doctorId: string) {
    setSelectedDoctores((prev) =>
      prev.includes(doctorId) ? prev.filter((d) => d !== doctorId) : [...prev, doctorId]
    )
  }

  if (loadingData || !secretary) {
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
            <Link href="/dashboard/secretarias" className="text-sm text-gray-500 hover:underline">
              ← Volver a Secretarias
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">Editar Secretaria</h1>
          </div>
          <button
            onClick={handleDelete}
            className="text-sm text-red-600 hover:underline font-medium"
          >
            Desactivar secretaria
          </button>
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
                  defaultValue={secretary.user.name}
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
                  defaultValue={secretary.user.email}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  name="phone"
                  defaultValue={secretary.phone || ""}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Doctores asignados */}
          <div>
            <h2 className="font-semibold text-gray-700 mb-4">Doctores asignados</h2>
            {doctores.length === 0 ? (
              <p className="text-sm text-gray-400">No hay doctores registrados</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {doctores.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => toggleDoctor(doc.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      selectedDoctores.includes(doc.id)
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {doc.user.name}
                  </button>
                ))}
              </div>
            )}
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