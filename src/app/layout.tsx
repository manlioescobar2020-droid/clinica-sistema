import type { Metadata } from "next"
import "./globals.css"
import Providers from "./providers"
import { getClinicConfig } from "@/lib/actions/clinic"

export async function generateMetadata(): Promise<Metadata> {
  const config = await getClinicConfig()
  const clinicName = config?.name ?? "Sistema de Gestión"
  return {
    title: {
      template: `%s | ${clinicName}`,
      default: clinicName,
    },
    description: `Sistema de gestión de turnos y pacientes — ${clinicName}`,
    robots: { index: false, follow: false },
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}