import type { Metadata } from "next"
import { getSecretaries } from "@/lib/actions/secretaries"
import Link from "next/link"

export const metadata: Metadata = { title: "Secretarias" }

export default async function SecretariasPage() {
  const secretarias = await getSecretaries()

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Secretarias</h1>
            <p className="text-gray-500 mt-1">{secretarias.length} secretarias registradas</p>
          </div>
          <Link
            href="/dashboard/secretarias/nueva"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition"
          >
            + Nueva Secretaria
          </Link>
        </div>

        {/* Lista */}
        {secretarias.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <p className="text-gray-400 text-lg">No hay secretarias registradas todavía</p>
            <Link
              href="/dashboard/secretarias/nueva"
              className="mt-4 inline-block text-blue-600 hover:underline"
            >
              Crear la primera secretaria
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {secretarias.map((sec) => (
              <div
                key={sec.id}
                className="bg-white rounded-2xl shadow-sm p-6 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg">
                    {sec.user.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{sec.user.name}</h2>
                    <p className="text-sm text-gray-500">{sec.user.email}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {sec.secretaryDoctors.length === 0 ? (
                        <span className="text-xs text-gray-400">Sin doctores asignados</span>
                      ) : (
                        sec.secretaryDoctors.map((sd) => (
                          <span
                            key={sd.doctorId}
                            className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full"
                          >
                            {sd.doctor.user.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full ${
                      sec.user.active
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {sec.user.active ? "Activa" : "Inactiva"}
                  </span>
                  <Link
                    href={`/dashboard/secretarias/${sec.id}`}
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