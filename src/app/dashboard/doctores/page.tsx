import type { Metadata } from "next"
import { getDoctors } from "@/lib/actions/doctors"
import Link from "next/link"

export const metadata: Metadata = { title: "Doctores" }

export default async function DoctoresPage() {
  const doctores = await getDoctors()

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Doctores</h1>
            <p className="text-gray-500 mt-1">{doctores.length} doctores registrados</p>
          </div>
          <Link
            href="/dashboard/doctores/nuevo"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition"
          >
            + Nuevo Doctor
          </Link>
        </div>

        {/* Lista */}
        {doctores.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <p className="text-gray-400 text-lg">No hay doctores registrados todavía</p>
            <Link
              href="/dashboard/doctores/nuevo"
              className="mt-4 inline-block text-blue-600 hover:underline"
            >
              Crear el primer doctor
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {doctores.map((doctor) => (
              <div
                key={doctor.id}
                className="bg-white rounded-2xl shadow-sm p-6 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                    {doctor.user.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{doctor.user.name}</h2>
                    <p className="text-sm text-gray-500">{doctor.user.email}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {doctor.specialties.map((ds) => (
                        <span
                          key={ds.specialtyId}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full"
                        >
                          {ds.specialty.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full ${
                      doctor.user.active
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {doctor.user.active ? "Activo" : "Inactivo"}
                  </span>
                  <Link
                    href={`/dashboard/doctores/${doctor.id}`}
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