"use client"

import { useState, useEffect } from "react"
import { getClinicConfig, updateClinicConfig } from "@/lib/actions/clinic"
import { changePassword } from "@/lib/actions/auth"

type ClinicConfig = Awaited<ReturnType<typeof getClinicConfig>>

const TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Cordoba",
  "America/Argentina/Mendoza",
  "America/Argentina/Salta",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Caracas",
  "America/Mexico_City",
  "America/Montevideo",
  "America/Asuncion",
  "UTC",
]

const CURRENCIES = [
  { code: "ARS", label: "ARS — Peso argentino" },
  { code: "USD", label: "USD — Dólar estadounidense" },
  { code: "CLP", label: "CLP — Peso chileno" },
  { code: "COP", label: "COP — Peso colombiano" },
  { code: "MXN", label: "MXN — Peso mexicano" },
  { code: "PEN", label: "PEN — Sol peruano" },
  { code: "UYU", label: "UYU — Peso uruguayo" },
]

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [config, setConfig] = useState<ClinicConfig>(null)

  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    getClinicConfig().then((data) => {
      setConfig(data)
      setLoadingData(false)
    })
  }, [])

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPwLoading(true)
    setPwError("")
    setPwSuccess(false)

    try {
      const formData = new FormData(e.currentTarget)
      await changePassword(formData)
      setPwSuccess(true)
      ;(e.target as HTMLFormElement).reset()
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Error al cambiar la contraseña")
    } finally {
      setPwLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess(false)

    try {
      const formData = new FormData(e.currentTarget)
      await updateClinicConfig(formData)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la configuración")
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <p className="text-gray-500 text-sm">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Configuración de la Clínica</h1>
          <p className="text-sm text-gray-500 mt-1">Datos generales del sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 space-y-8">

          {/* Datos generales */}
          <div>
            <h2 className="font-semibold text-gray-700 mb-4">Datos generales</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la clínica *
                </label>
                <input
                  name="name"
                  required
                  defaultValue={config?.name ?? ""}
                  placeholder="Ej: Clínica San Martín"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  name="phone"
                  defaultValue={config?.phone ?? ""}
                  placeholder="Ej: +54 11 4567-8900"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  defaultValue={config?.email ?? ""}
                  placeholder="contacto@clinica.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  name="address"
                  defaultValue={config?.address ?? ""}
                  placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Configuración regional */}
          <div>
            <h2 className="font-semibold text-gray-700 mb-4">Configuración regional</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zona horaria
                </label>
                <select
                  name="timezone"
                  defaultValue={config?.timezone ?? "America/Argentina/Buenos_Aires"}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda
                </label>
                <select
                  name="currency"
                  defaultValue={config?.currency ?? "ARS"}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg">
              Configuración guardada correctamente.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar configuración"}
          </button>
        </form>

        {/* Cambiar contraseña */}
        <form onSubmit={handlePasswordSubmit} className="bg-white rounded-2xl shadow-sm p-8 space-y-6 mt-8">
          <div>
            <h2 className="font-semibold text-gray-700 mb-1">Cambiar contraseña</h2>
            <p className="text-sm text-gray-500">Actualizá tu contraseña de acceso</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña actual *
              </label>
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva contraseña *
              </label>
              <input
                name="newPassword"
                type="password"
                required
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar nueva contraseña *
              </label>
              <input
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {pwError && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg">
              Contraseña actualizada correctamente.
            </p>
          )}

          <button
            type="submit"
            disabled={pwLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {pwLoading ? "Actualizando..." : "Cambiar contraseña"}
          </button>
        </form>

      </div>
    </div>
  )
}
