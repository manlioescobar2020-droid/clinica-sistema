"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { RoleName } from "@prisma/client"

// ============================================================
// HELPER
// ============================================================

async function requirePatient() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("No autorizado")
  if (![RoleName.PATIENT, RoleName.PROSPECT].includes(session.user.role as RoleName)) {
    throw new Error("No autorizado")
  }
  return session
}

// ============================================================
// OBTENER DATOS DEL PACIENTE
// ============================================================

export async function getMyProfile() {
  const session = await requirePatient()

  return prisma.person.findFirst({
    where: { user: { id: session.user.id }, deletedAt: null },
    include: {
      user: { select: { name: true, email: true } },
    },
  })
}

// ============================================================
// OBTENER MIS TURNOS
// ============================================================

export async function getMyAppointments() {
  const session = await requirePatient()

  const person = await prisma.person.findFirst({
    where: { user: { id: session.user.id }, deletedAt: null },
  })
  if (!person) throw new Error("Perfil no encontrado")

  const now = new Date()

  const [upcoming, past] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        personId: person.id,
        startTime: { gte: now },
        status: { notIn: ["CANCELLED_PATIENT", "CANCELLED_CLINIC"] },
      },
      include: {
        doctor: { include: { user: { select: { name: true } }, specialties: { include: { specialty: true } } } },
        payment: true,
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        personId: person.id,
        startTime: { lt: now },
      },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        payment: true,
      },
      orderBy: { startTime: "desc" },
      take: 20,
    }),
  ])

  return { upcoming, past }
}

// ============================================================
// CANCELAR MI TURNO
// ============================================================

export async function cancelMyAppointment(appointmentId: string) {
  const session = await requirePatient()

  const person = await prisma.person.findFirst({
    where: { user: { id: session.user.id }, deletedAt: null },
  })
  if (!person) throw new Error("Perfil no encontrado")

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      personId: person.id,
      status: { notIn: ["CANCELLED_PATIENT", "CANCELLED_CLINIC", "ATTENDED", "NO_SHOW"] },
    },
  })
  if (!appointment) throw new Error("Turno no encontrado o no se puede cancelar")

  try {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELLED_PATIENT",
        cancelReason: "Cancelado por el paciente",
      },
    })

    revalidatePath("/portal")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo cancelar el turno. Intente nuevamente.", { cause: error })
  }
}