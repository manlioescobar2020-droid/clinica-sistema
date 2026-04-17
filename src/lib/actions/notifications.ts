"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { NotificationType } from "@prisma/client"

// ============================================================
// OBTENER NOTIFICACIONES DEL USUARIO
// ============================================================

export async function getMyNotifications() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("No autorizado")

  return prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  })
}

export async function getUnreadCount() {
  const session = await getServerSession(authOptions)
  if (!session) return 0

  return prisma.notification.count({
    where: { userId: session.user.id, read: false },
  })
}

// ============================================================
// MARCAR COMO LEÍDA
// ============================================================

export async function markAsRead(notificationId: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("No autorizado")

  try {
    await prisma.notification.update({
      where: { id: notificationId, userId: session.user.id },
      data: { read: true, readAt: new Date() },
    })

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo marcar la notificación. Intente nuevamente.", { cause: error })
  }
}

export async function markAllAsRead() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("No autorizado")

  try {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true, readAt: new Date() },
    })

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudieron marcar las notificaciones. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// CREAR NOTIFICACIÓN (uso interno)
// ============================================================

export async function createNotification({
  userId,
  type,
  title,
  message,
  metadata,
}: {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: any
}) {
  return prisma.notification.create({
    data: { userId, type, title, message, metadata },
  })
}

// ============================================================
// NOTIFICAR NUEVO TURNO A DOCTOR Y SECRETARIAS
// ============================================================

export async function notifyNewAppointment(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      person: true,
      doctor: {
        include: {
          secretaryDoctors: { include: { secretary: true } },
        },
      },
    },
  })
  if (!appointment) return

  const fecha = appointment.startTime.toISOString().substring(0, 10)
  const hora = appointment.startTime.toISOString().substring(11, 16)
  const paciente = `${appointment.person.firstName} ${appointment.person.lastName}`

  const userIds = [
    appointment.doctor.userId,
    ...appointment.doctor.secretaryDoctors.map((sd) => sd.secretary.userId),
  ]

  await Promise.all(
    userIds.map((userId) =>
      createNotification({
        userId,
        type: NotificationType.NEW_APPOINTMENT,
        title: "Nuevo turno reservado",
        message: `${paciente} tiene turno el ${fecha} a las ${hora}`,
        metadata: { appointmentId },
      })
    )
  )
}

// ============================================================
// NOTIFICAR CANCELACIÓN
// ============================================================

export async function notifyCancellation(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      person: true,
      doctor: {
        include: {
          secretaryDoctors: { include: { secretary: true } },
        },
      },
    },
  })
  if (!appointment) return

  const fecha = appointment.startTime.toISOString().substring(0, 10)
  const hora = appointment.startTime.toISOString().substring(11, 16)
  const paciente = `${appointment.person.firstName} ${appointment.person.lastName}`

  const userIds = [
    appointment.doctor.userId,
    ...appointment.doctor.secretaryDoctors.map((sd) => sd.secretary.userId),
  ]

  await Promise.all(
    userIds.map((userId) =>
      createNotification({
        userId,
        type: NotificationType.CANCELLATION,
        title: "Turno cancelado",
        message: `Se canceló el turno de ${paciente} del ${fecha} a las ${hora}`,
        metadata: { appointmentId },
      })
    )
  )
}