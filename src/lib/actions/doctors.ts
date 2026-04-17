"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { RoleName, DayOfWeek } from "@prisma/client"

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
// OBTENER TODOS LOS DOCTORES
// ============================================================

export async function getDoctors() {
  return prisma.doctor.findMany({
    where: { deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, active: true } },
      specialties: { include: { specialty: true } },
    },
    orderBy: { user: { name: "asc" } },
    take: 500,
  })
}

// ============================================================
// OBTENER UN DOCTOR
// ============================================================

export async function getDoctorById(id: string) {
  return prisma.doctor.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, active: true } },
      specialties: { include: { specialty: true } },
      schedules: { orderBy: { dayOfWeek: "asc" } },
    },
  })
}

// ============================================================
// CREAR DOCTOR
// ============================================================

export async function createDoctor(formData: FormData) {
  await requireAdmin()

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const licenseNumber = formData.get("licenseNumber") as string
  const phone = formData.get("phone") as string
  const bio = formData.get("bio") as string
  const specialtyIds = formData.getAll("specialtyIds") as string[]

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error("El email ya está registrado")

  const hashedPassword = await bcrypt.hash(password, 12)

  const doctorRole = await prisma.role.findUnique({
    where: { name: RoleName.DOCTOR },
  })
  if (!doctorRole) throw new Error("Rol DOCTOR no encontrado")

  try {
    const doctor = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          roleId: doctorRole.id,
        },
      })

      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          licenseNumber: licenseNumber || null,
          phone: phone || null,
          bio: bio || null,
          specialties: {
            create: specialtyIds.map((id) => ({ specialtyId: id })),
          },
        },
      })

      return doctor
    })

    revalidatePath("/dashboard/doctores")
    return { success: true, doctorId: doctor.id }
  } catch (error) {
    throw new Error("No se pudo crear el doctor. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// EDITAR DOCTOR
// ============================================================

export async function updateDoctor(id: string, formData: FormData) {
  await requireAdmin()

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const licenseNumber = formData.get("licenseNumber") as string
  const phone = formData.get("phone") as string
  const bio = formData.get("bio") as string
  const specialtyIds = formData.getAll("specialtyIds") as string[]

  const doctor = await prisma.doctor.findFirst({ where: { id, deletedAt: null } })
  if (!doctor) throw new Error("Doctor no encontrado")

  const emailConflict = await prisma.user.findFirst({ where: { email, NOT: { id: doctor.userId } } })
  if (emailConflict) throw new Error("El email ya está registrado por otro usuario")

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: doctor.userId },
        data: { name, email },
      })

      await tx.doctor.update({
        where: { id },
        data: {
          licenseNumber: licenseNumber || null,
          phone: phone || null,
          bio: bio || null,
        },
      })

      await tx.doctorSpecialty.deleteMany({ where: { doctorId: id } })
      if (specialtyIds.length > 0) {
        await tx.doctorSpecialty.createMany({
          data: specialtyIds.map((specialtyId) => ({ doctorId: id, specialtyId })),
        })
      }
    })

    revalidatePath("/dashboard/doctores")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo actualizar el doctor. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// SOFT DELETE
// ============================================================

export async function deleteDoctor(id: string) {
  await requireAdmin()

  const doctor = await prisma.doctor.findUnique({ where: { id } })
  if (!doctor) throw new Error("Doctor no encontrado")

  try {
    await prisma.$transaction(async (tx) => {
      await tx.doctor.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      await tx.user.update({
        where: { id: doctor.userId },
        data: { active: false },
      })
    })

    revalidatePath("/dashboard/doctores")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo eliminar el doctor. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// ESPECIALIDADES
// ============================================================

export async function getSpecialties() {
  return prisma.specialty.findMany({ orderBy: { name: "asc" } })
}

export async function createSpecialty(name: string) {
  await requireAdmin()
  try {
    const specialty = await prisma.specialty.create({ data: { name } })
    revalidatePath("/dashboard/doctores")
    return specialty
  } catch (error) {
    throw new Error("No se pudo crear la especialidad. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// AGENDA SEMANAL
// ============================================================

export async function getDoctorSchedules(doctorId: string) {
  return prisma.doctorSchedule.findMany({
    where: { doctorId },
    orderBy: { dayOfWeek: "asc" },
  })
}

export async function upsertSchedule(doctorId: string, formData: FormData) {
  await requireAdmin()

  const dayOfWeek = formData.get("dayOfWeek") as string
  const startTime = formData.get("startTime") as string
  const endTime = formData.get("endTime") as string
  const slotDuration = parseInt(formData.get("slotDuration") as string)

  try {
    await prisma.doctorSchedule.create({
      data: {
        doctorId,
        dayOfWeek: dayOfWeek as DayOfWeek,
        startTime,
        endTime,
        slotDuration,
      },
    })

    revalidatePath(`/dashboard/doctores/${doctorId}/agenda`)
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo guardar el horario. Intente nuevamente.", { cause: error })
  }
}

export async function deleteSchedule(scheduleId: string, doctorId: string) {
  await requireAdmin()
  try {
    await prisma.doctorSchedule.delete({ where: { id: scheduleId } })
    revalidatePath(`/dashboard/doctores/${doctorId}/agenda`)
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo eliminar el horario. Intente nuevamente.", { cause: error })
  }
}