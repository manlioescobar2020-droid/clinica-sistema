"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { RoleName } from "@prisma/client"

// ============================================================
// HELPERS
// ============================================================

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== RoleName.ADMIN) {
    throw new Error("No autorizado")
  }
  return session
}

// ============================================================
// OBTENER CONFIGURACIÓN
// ============================================================

export async function getClinicConfig() {
  return prisma.clinicConfig.findFirst()
}

// ============================================================
// ACTUALIZAR CONFIGURACIÓN
// ============================================================

export async function updateClinicConfig(formData: FormData) {
  await requireAdmin()

  const name = formData.get("name") as string
  const phone = formData.get("phone") as string
  const email = formData.get("email") as string
  const address = formData.get("address") as string
  const timezone = formData.get("timezone") as string
  const currency = formData.get("currency") as string

  if (!name?.trim()) throw new Error("El nombre de la clínica es obligatorio")

  const data = {
    name: name.trim(),
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    address: address?.trim() || null,
    timezone: timezone || "America/Argentina/Buenos_Aires",
    currency: currency || "ARS",
  }

  try {
    const existing = await prisma.clinicConfig.findFirst()

    if (existing) {
      await prisma.clinicConfig.update({ where: { id: existing.id }, data })
    } else {
      await prisma.clinicConfig.create({ data })
    }

    revalidatePath("/dashboard/configuracion")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo guardar la configuración. Intente nuevamente.", { cause: error })
  }
}
