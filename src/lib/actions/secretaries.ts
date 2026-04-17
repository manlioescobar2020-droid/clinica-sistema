"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
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
// OBTENER TODAS LAS SECRETARIAS
// ============================================================

export async function getSecretaries() {
  return prisma.secretary.findMany({
    where: { deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, active: true } },
      secretaryDoctors: {
        include: {
          doctor: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { user: { name: "asc" } },
  })
}

// ============================================================
// OBTENER UNA SECRETARIA
// ============================================================

export async function getSecretaryById(id: string) {
  return prisma.secretary.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, active: true } },
      secretaryDoctors: {
        include: {
          doctor: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
      },
    },
  })
}

// ============================================================
// CREAR SECRETARIA
// ============================================================

export async function createSecretary(formData: FormData) {
  await requireAdmin()

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const phone = formData.get("phone") as string
  const doctorIds = formData.getAll("doctorIds") as string[]

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error("El email ya está registrado")

  if (doctorIds.length > 0) {
    const foundDoctors = await prisma.doctor.count({ where: { id: { in: doctorIds }, deletedAt: null } })
    if (foundDoctors !== doctorIds.length) throw new Error("Uno o más doctores seleccionados no existen")
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const secretaryRole = await prisma.role.findUnique({
    where: { name: RoleName.SECRETARY },
  })
  if (!secretaryRole) throw new Error("Rol SECRETARY no encontrado")

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          roleId: secretaryRole.id,
        },
      })

      await tx.secretary.create({
        data: {
          userId: user.id,
          phone: phone || null,
          secretaryDoctors: {
            create: doctorIds.map((doctorId) => ({ doctorId })),
          },
        },
      })
    })

    revalidatePath("/dashboard/secretarias")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo crear la secretaria. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// EDITAR SECRETARIA
// ============================================================

export async function updateSecretary(id: string, formData: FormData) {
  await requireAdmin()

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const doctorIds = formData.getAll("doctorIds") as string[]

  const secretary = await prisma.secretary.findFirst({ where: { id, deletedAt: null } })
  if (!secretary) throw new Error("Secretaria no encontrada")

  const emailConflict = await prisma.user.findFirst({ where: { email, NOT: { id: secretary.userId } } })
  if (emailConflict) throw new Error("El email ya está registrado por otro usuario")

  if (doctorIds.length > 0) {
    const foundDoctors = await prisma.doctor.count({ where: { id: { in: doctorIds }, deletedAt: null } })
    if (foundDoctors !== doctorIds.length) throw new Error("Uno o más doctores seleccionados no existen")
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: secretary.userId },
        data: { name, email },
      })

      await tx.secretary.update({
        where: { id },
        data: { phone: phone || null },
      })

      await tx.secretaryDoctor.deleteMany({ where: { secretaryId: id } })
      if (doctorIds.length > 0) {
        await tx.secretaryDoctor.createMany({
          data: doctorIds.map((doctorId) => ({ secretaryId: id, doctorId })),
        })
      }
    })

    revalidatePath("/dashboard/secretarias")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo actualizar la secretaria. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// SOFT DELETE
// ============================================================

export async function deleteSecretary(id: string) {
  await requireAdmin()

  const secretary = await prisma.secretary.findUnique({ where: { id } })
  if (!secretary) throw new Error("Secretaria no encontrada")

  try {
    await prisma.$transaction(async (tx) => {
      await tx.secretary.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      await tx.user.update({
        where: { id: secretary.userId },
        data: { active: false },
      })
    })

    revalidatePath("/dashboard/secretarias")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo eliminar la secretaria. Intente nuevamente.", { cause: error })
  }
}