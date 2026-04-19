"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { RoleName } from "@prisma/client"
import bcrypt from "bcryptjs"

type ActionResult = { success: true } | { success: false; error: string }

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: "No autorizado" }

  const currentPassword = formData.get("currentPassword") as string
  const newPassword = formData.get("newPassword") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, error: "Todos los campos son obligatorios" }
  }

  if (newPassword.length < 6) {
    return { success: false, error: "La nueva contraseña debe tener al menos 6 caracteres" }
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "Las contraseñas no coinciden" }
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return { success: false, error: "Usuario no encontrado" }

  const passwordMatch = await bcrypt.compare(currentPassword, user.password)
  if (!passwordMatch) return { success: false, error: "La contraseña actual es incorrecta" }

  const hashed = await bcrypt.hash(newPassword, 10)

  try {
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
    return { success: true }
  } catch {
    return { success: false, error: "No se pudo actualizar la contraseña. Intente nuevamente." }
  }
}

export async function getMyRole(): Promise<RoleName | null> {
  const session = await getServerSession(authOptions)
  return (session?.user?.role as RoleName) ?? null
}

export async function resetPassword(userId: string, newPassword: string): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: "No autorizado" }
  if (session.user.role !== RoleName.ADMIN) {
    return { success: false, error: "Solo el administrador puede resetear contraseñas" }
  }

  if (!userId || !newPassword?.trim()) return { success: false, error: "Datos inválidos" }
  if (newPassword.length < 6) {
    return { success: false, error: "La contraseña debe tener al menos 6 caracteres" }
  }

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) return { success: false, error: "Usuario no encontrado" }

  const hashed = await bcrypt.hash(newPassword, 10)

  try {
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
    return { success: true }
  } catch {
    return { success: false, error: "No se pudo resetear la contraseña. Intente nuevamente." }
  }
}
