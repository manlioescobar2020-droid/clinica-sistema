import type { Metadata } from "next"
import { getMyProfile } from "@/lib/actions/portal"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "Mi Perfil" }

export default async function PerfilPage() {
  const profile = await getMyProfile()
  if (!profile) redirect("/portal")

  const rows: { label: string; value: string }[] = [
    { label: "Nombre completo", value: `${profile.firstName} ${profile.lastName}` },
    { label: "DNI",             value: profile.dni },
    { label: "Email",           value: profile.email ?? profile.user?.email ?? "—" },
    { label: "Teléfono",        value: profile.phone ?? "—" },
  ]

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-xl font-bold text-gray-900">Mi Perfil</h2>
        <p className="text-sm text-gray-500 mt-1">Tus datos personales registrados en la clínica</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="text-sm text-gray-900 font-medium text-right">{value}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Para modificar tus datos contactá a la clínica.
      </p>

    </div>
  )
}
