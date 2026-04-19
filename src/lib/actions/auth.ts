"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function changePassword(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")

  const currentPassword = formData.get("currentPassword") as string
  const newPassword = formData.get("newPassword") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error("Todos los campos son obligatorios")
  }

  if (newPassword.length < 6) {
    throw new Error("La nueva contraseña debe tener al menos 6 caracteres")
  }

  if (newPassword !== confirmPassword) {
    throw new Error("Las contraseñas no coinciden")
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) throw new Error("Usuario no encontrado")

  const passwordMatch = await bcrypt.compare(currentPassword, user.password)
  if (!passwordMatch) throw new Error("La contraseña actual es incorrecta")

  const hashed = await bcrypt.hash(newPassword, 10)

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    })
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo actualizar la contraseña. Intente nuevamente.", { cause: error })
  }
}
