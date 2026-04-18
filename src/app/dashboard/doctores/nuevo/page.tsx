"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createDoctor, createSpecialty, getSpecialties } from "@/lib/actions/doctors"
import { useEffect } from "react"
import Link from "next/link"

export default function NuevoDoctorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [especialidades, setEspecialidades] = useState<{ id: string; name: string }[]>([])
  const [selectedEspecialidades, setSelectedEspecialidades] = useState<string[]>([])
  const [nuevaEspecialidad, setNuevaEspecialidad] = useState("")

  useEffect(() => {
    getSpecialties().then(setEspecialidades)
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const formData = new FormData(e.currentTarget)
      selectedEspecialidades.forEach((id) => formData.append("specialtyIds", id))
      await createDoctor(formData)
      router.push("/dashboard/doctores")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el doctor")
      setLoading(false)
    }
  }

  async function handleAddEspecialidad() {
    if (!nuevaEspecialidad.trim()) return
    try {
      const esp = await createSpecialty(nuevaEspecialidad.trim())
      setEspecialidades((prev) => [...prev, esp])
      setNuevaEspecialidad("")
    } catch {
      setError("Error al crear especialidad")
    }
  }

  function toggleEspecialidad(id: string) {
    setSelectedEspecialidades((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/dashboard/doctores" className="text-sm text-gray-500 hover:underline">
            ← Volver a Doctores
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Nuevo Doctor</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
          {/* Datos personales */}
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dr. Juan Pérez"
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="doctor@clinica.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña inicial *
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Matrícula
                  </label>
                  <input
                    name="licenseNumber"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="MP 12345"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    name="phone"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+54 9 11 1234-5678"
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Especialista en..."
                />
              </div>
            </div>
          </div>

          {/* Especialidades */}
          <div>
            <h2 className="font-semibold text-gray-700 mb-4">Especialidades</h2>
            <div className="flex flex-wrap gap-2 mb-3">
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
            <div className="flex gap-2">
              <input
                value={nuevaEspecialidad}
                onChange={(e) => setNuevaEspecialidad(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nueva especialidad..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddEspecialidad())}
              />
              <button
                type="button"
                onClick={handleAddEspecialidad}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                + Agregar
              </button>
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
            {loading ? "Creando doctor..." : "Crear Doctor"}
          </button>
        </form>
      </div>
    </div>
  )
}