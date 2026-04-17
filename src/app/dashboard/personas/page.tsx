"use client"

import { useState, useEffect } from "react"
import { getPersons } from "@/lib/actions/persons"

type Persons = Awaited<ReturnType<typeof getPersons>>
import Link from "next/link"
import { PersonStatus } from "@prisma/client"

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

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persons>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<PersonStatus | "">("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getPersons(search || undefined, status || undefined).then((data) => {
      setPersonas(data)
      setLoading(false)
    })
  }, [search, status])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Personas</h1>
            <p className="text-gray-500 mt-1">
              {personas.length} personas encontradas
            </p>
          </div>
          <Link
            href="/dashboard/personas/nueva"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition"
          >
            + Nueva Persona
          </Link>
        </div>

        {/* Filtros */}
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="Buscar por nombre, DNI o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PersonStatus | "")}
            className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : personas.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <p className="text-gray-400 text-lg">No se encontraron personas</p>
            <Link
              href="/dashboard/personas/nueva"
              className="mt-4 inline-block text-blue-600 hover:underline"
            >
              Crear la primera persona
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {personas.map((persona) => (
              <div
                key={persona.id}
                className="bg-white rounded-2xl shadow-sm p-6 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg">
                    {persona.firstName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {persona.lastName}, {persona.firstName}
                    </h2>
                    <p className="text-sm text-gray-500">DNI: {persona.dni}</p>
                    <p className="text-sm text-gray-400">{persona.email || "Sin email"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_COLORS[persona.status as PersonStatus]}`}
                  >
                    {STATUS_LABELS[persona.status as PersonStatus]}
                  </span>
                  <Link
                    href={`/dashboard/personas/${persona.id}`}
                    className="text-sm text-blue-600 hover:underline font-medium"
                  >
                    Ver / Editar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}