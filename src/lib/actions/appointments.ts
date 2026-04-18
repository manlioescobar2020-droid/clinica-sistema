"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { RoleName, AppointmentStatus, AuditAction, DayOfWeek, PaymentStatus, Prisma } from "@prisma/client"
import { notifyNewAppointment, notifyCancellation } from "@/lib/actions/notifications"
import { createAuditLog } from "@/lib/audit"

// ============================================================
// HELPERS
// ============================================================

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("No autorizado")
  return session
}

function generateSlots(startTime: string, endTime: string, slotDuration: number): string[] {
  const slots: string[] = []
  const [startH, startM] = startTime.split(":").map(Number)
  const [endH, endM] = endTime.split(":").map(Number)
  let current = startH * 60 + startM
  const end = endH * 60 + endM
  while (current + slotDuration <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, "0")
    const m = (current % 60).toString().padStart(2, "0")
    slots.push(`${h}:${m}`)
    current += slotDuration
  }
  return slots
}

// ============================================================
// OBTENER SLOTS DISPONIBLES DE UN DOCTOR EN UNA FECHA
// ============================================================

export async function getAvailableSlots(doctorId: string, date: string) {
  await requireSession()

  const dateObj = new Date(date)
  const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"]
  const dayOfWeek = days[dateObj.getUTCDay()]

  // Traer franjas del día
  const schedules = await prisma.doctorSchedule.findMany({
    where: { doctorId, dayOfWeek: dayOfWeek as DayOfWeek, active: true },
  })

  if (schedules.length === 0) return []

  // Verificar si hay bloqueo de agenda ese día
  const startOfDay = new Date(date + "T00:00:00.000Z")
  const endOfDay = new Date(date + "T23:59:59.999Z")

  const blocks = await prisma.agendaBlock.findMany({
    where: {
      doctorId,
      date: { gte: startOfDay, lte: endOfDay },
    },
  })

  // Si hay bloqueo de día completo, no hay slots
  const fullDayBlock = blocks.find(b => !b.startTime && !b.endTime)
  if (fullDayBlock) return []

  // Traer turnos ya reservados ese día
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      startTime: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ["CANCELLED_PATIENT", "CANCELLED_CLINIC"] },
    },
  })

  const takenSlots = existingAppointments.map(a =>
    a.startTime.toISOString().substring(11, 16)
  )

  // Generar slots disponibles
  const allSlots: { time: string; scheduleId: string; duration: number }[] = []

  for (const schedule of schedules) {
    const slots = generateSlots(schedule.startTime, schedule.endTime, schedule.slotDuration)

    // Verificar si esta franja está bloqueada
    const isFranjaBlocked = blocks.some(b => {
      if (!b.startTime || !b.endTime) return false
      return schedule.startTime >= b.startTime && schedule.endTime <= b.endTime
    })
    if (isFranjaBlocked) continue

    for (const slot of slots) {
      if (!takenSlots.includes(slot)) {
        allSlots.push({
          time: slot,
          scheduleId: schedule.id,
          duration: schedule.slotDuration,
        })
      }
    }
  }

  return allSlots
}

// ============================================================
// OBTENER TURNOS (con filtros)
// ============================================================

export async function getAppointments(filters?: {
  doctorId?: string
  date?: string
  status?: AppointmentStatus
  personId?: string
}) {
  await requireSession()

  const where: Prisma.AppointmentWhereInput = {}

  if (filters?.doctorId) where.doctorId = filters.doctorId
  if (filters?.status) where.status = filters.status
  if (filters?.personId) where.personId = filters.personId

  if (filters?.date) {
    const startOfDay = new Date(filters.date + "T00:00:00.000Z")
    const endOfDay = new Date(filters.date + "T23:59:59.999Z")
    where.startTime = { gte: startOfDay, lte: endOfDay }
  }

  return prisma.appointment.findMany({
    where,
    include: {
      person: { select: { id: true, firstName: true, lastName: true, dni: true, phone: true } },
      doctor: { include: { user: { select: { name: true } } } },
      payment: true,
    },
    orderBy: { startTime: "asc" },
  })
}

// ============================================================
// OBTENER UN TURNO
// ============================================================

export async function getAppointmentById(id: string) {
  await requireSession()

  return prisma.appointment.findUnique({
    where: { id },
    include: {
      person: true,
      doctor: { include: { user: { select: { name: true } } } },
      schedule: true,
      payment: true,
    },
  })
}

// ============================================================
// CREAR TURNO MANUAL
// ============================================================

export async function createAppointment(formData: FormData) {
  const session = await requireSession()
  const role = session.user.role

  if (!([RoleName.ADMIN, RoleName.SECRETARY, RoleName.DOCTOR] as RoleName[]).includes(role)) {
    throw new Error("No autorizado")
  }

  const personId = formData.get("personId") as string
  const doctorId = formData.get("doctorId") as string
  const scheduleId = formData.get("scheduleId") as string
  const date = formData.get("date") as string
  const time = formData.get("time") as string
  const duration = parseInt(formData.get("duration") as string)
  const notes = formData.get("notes") as string

  const startTime = new Date(`${date}T${time}:00.000Z`)
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

  // Verificar que el slot no esté tomado
  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId,
      startTime,
      status: { notIn: ["CANCELLED_PATIENT", "CANCELLED_CLINIC"] },
    },
  })
  if (conflict) throw new Error("Ese horario ya está reservado")

  try {
    const appointment = await prisma.appointment.create({
      data: {
        personId,
        doctorId,
        scheduleId: scheduleId || null,
        startTime,
        endTime,
        notes: notes || null,
        status: "RESERVED",
        payment: {
          create: {
            status: "NO_PAYMENT",
            amount: 0,
          },
        },
      },
    })

    await notifyNewAppointment(appointment.id).catch(() => {})
    await createAuditLog({
      performedBy: session.user.id,
      entity: "Appointment",
      entityId: appointment.id,
      action: AuditAction.CREATE,
      newData: { personId, doctorId, startTime: startTime.toISOString(), status: "RESERVED" },
    }).catch(() => {})
    revalidatePath("/dashboard/turnos")
    return { success: true, appointmentId: appointment.id }
  } catch (error) {
    throw new Error("No se pudo crear el turno. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// CAMBIAR ESTADO DE TURNO
// ============================================================

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  cancelReason?: string
) {
  const session = await requireSession()
  const role = session.user.role

  // Solo doctor puede marcar ATENDIDO o NO_ASISTIO
  if (
    ([AppointmentStatus.ATTENDED, AppointmentStatus.NO_SHOW] as AppointmentStatus[]).includes(status) &&
    !([RoleName.DOCTOR, RoleName.ADMIN, RoleName.SECRETARY] as RoleName[]).includes(role)
  ) {
    throw new Error("No autorizado")
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { person: true },
  })
  if (!appointment) throw new Error("Turno no encontrado")

  try {
    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: {
          status,
          cancelReason: cancelReason || null,
        },
      })

      // Si se marca como ATENDIDO y la persona es PROSPECTO → pasa a ACTIVO
      if (status === AppointmentStatus.ATTENDED && appointment.person.status === "PROSPECT") {
        await tx.person.update({
          where: { id: appointment.personId },
          data: { status: "ACTIVE" },
        })
      }
    })

    await createAuditLog({
      performedBy: session.user.id,
      entity: "Appointment",
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      previousData: { status: appointment.status },
      newData: { status, ...(cancelReason && { cancelReason }) },
    }).catch(() => {})
    revalidatePath("/dashboard/turnos")
    revalidatePath(`/dashboard/turnos/${id}`)
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo actualizar el estado del turno.", { cause: error })
  }
}

// ============================================================
// CANCELAR TURNO (paciente o clínica)
// ============================================================

export async function cancelAppointment(
  id: string,
  cancelledBy: "PATIENT" | "CLINIC",
  reason?: string
) {
  const session = await requireSession()

  const previous = await prisma.appointment.findUnique({
    where: { id },
    select: { status: true },
  })

  const status =
    cancelledBy === "PATIENT"
      ? AppointmentStatus.CANCELLED_PATIENT
      : AppointmentStatus.CANCELLED_CLINIC

  try {
    await prisma.appointment.update({
      where: { id },
      data: { status, cancelReason: reason || null },
    })

    await notifyCancellation(id).catch(() => {})
    await createAuditLog({
      performedBy: session.user.id,
      entity: "Appointment",
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      previousData: previous ? { status: previous.status } : undefined,
      newData: { status, ...(reason && { cancelReason: reason }) },
    }).catch(() => {})
    revalidatePath("/dashboard/turnos")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo cancelar el turno. Intente nuevamente.", { cause: error })
  }
}
// ============================================================
// REGISTRAR PAGO MANUAL
// ============================================================

export async function registerManualPayment(
  appointmentId: string,
  formData: FormData
) {
  const session = await requireSession()
  const role = session.user.role

  if (!([RoleName.ADMIN, RoleName.SECRETARY] as RoleName[]).includes(role)) {
    throw new Error("No autorizado")
  }

  const method = formData.get("method") as string
  const amount = parseFloat(formData.get("amount") as string)

  if (!method || isNaN(amount) || amount <= 0) {
    throw new Error("Datos de pago inválidos")
  }

  const validMethods = ["PAID_CASH", "PAID_TRANSFER", "PAID_CARD"]
  if (!validMethods.includes(method)) {
    throw new Error("Método de pago inválido")
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { payment: true },
  })
  if (!appointment) throw new Error("Turno no encontrado")
  if (!appointment.payment) throw new Error("El turno no tiene registro de pago")

  try {
    await prisma.payment.update({
      where: { appointmentId },
      data: {
        status: method as PaymentStatus,
        amount,
      },
    })

    await createAuditLog({
      performedBy: session.user.id,
      entity: "Payment",
      entityId: appointment.payment.id,
      action: AuditAction.PAYMENT_REGISTERED,
      previousData: { status: appointment.payment.status, amount: Number(appointment.payment.amount) },
      newData: { status: method, amount },
    }).catch(() => {})
    revalidatePath("/dashboard/turnos")
    revalidatePath(`/dashboard/turnos/${appointmentId}`)
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo registrar el pago. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// REGISTRAR DEVOLUCIÓN MANUAL
// ============================================================

export async function registerRefund(appointmentId: string, reason?: string) {
  const session = await requireSession()
  const role = session.user.role

  if (!([RoleName.ADMIN, RoleName.SECRETARY] as RoleName[]).includes(role)) {
    throw new Error("No autorizado")
  }

  try {
    await prisma.payment.update({
      where: { appointmentId },
      data: {
        status: "REFUNDED",
        refundedAt: new Date(),
        refundReason: reason || null,
      },
    })

    revalidatePath("/dashboard/turnos")
    revalidatePath(`/dashboard/turnos/${appointmentId}`)
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo registrar la devolución. Intente nuevamente.", { cause: error })
  }
}
// ============================================================
// CIERRE DE AGENDA
// ============================================================

export async function getAgendaBlocks(doctorId: string) {
  await requireSession()

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  return prisma.agendaBlock.findMany({
    where: {
      doctorId,
      date: { gte: today },
    },
    orderBy: { date: "asc" },
  })
}

export async function createAgendaBlock(doctorId: string, formData: FormData) {
  const session = await requireSession()
  const role = session.user.role

  if (!([RoleName.ADMIN, RoleName.SECRETARY, RoleName.DOCTOR] as RoleName[]).includes(role)) {
    throw new Error("No autorizado")
  }

  const date = formData.get("date") as string
  const type = formData.get("type") as string // "full" | "partial"
  const startTime = formData.get("startTime") as string | null
  const endTime = formData.get("endTime") as string | null
  const reason = formData.get("reason") as string

  if (!date || !reason) throw new Error("Fecha y motivo son requeridos")

  const blockDate = new Date(date + "T12:00:00.000Z")

  // Verificar si ya existe un bloqueo ese día
  const startOfDay = new Date(date + "T00:00:00.000Z")
  const endOfDay = new Date(date + "T23:59:59.999Z")

  const existing = await prisma.agendaBlock.findFirst({
    where: {
      doctorId,
      date: { gte: startOfDay, lte: endOfDay },
      startTime: null,
      endTime: null,
    },
  })
  if (existing) throw new Error("Ya existe un cierre de día completo para esa fecha")

  try {
    // Crear el bloqueo
    const block = await prisma.agendaBlock.create({
      data: {
        doctorId,
        date: blockDate,
        startTime: type === "partial" ? startTime : null,
        endTime: type === "partial" ? endTime : null,
        reason,
      },
    })

    // Cancelar turnos que caigan en ese bloqueo
    const whereAppointments: Prisma.AppointmentWhereInput = {
      doctorId,
      startTime: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ["CANCELLED_PATIENT", "CANCELLED_CLINIC"] },
    }

    if (type === "partial" && startTime && endTime) {
      const blockStart = new Date(`${date}T${startTime}:00.000Z`)
      const blockEnd = new Date(`${date}T${endTime}:00.000Z`)
      whereAppointments.startTime = { gte: blockStart, lte: blockEnd }
    }

    const affected = await prisma.appointment.findMany({
      where: whereAppointments,
    })

    if (affected.length > 0) {
      await prisma.appointment.updateMany({
        where: { id: { in: affected.map((a) => a.id) } },
        data: {
          status: "CANCELLED_CLINIC",
          cancelReason: `Agenda cerrada: ${reason}`,
        },
      })
    }

    await createAuditLog({
      performedBy: session.user.id,
      entity: "AgendaBlock",
      entityId: block.id,
      action: AuditAction.AGENDA_BLOCKED,
      newData: { doctorId, date: blockDate.toISOString(), type, reason, cancelledCount: affected.length },
    }).catch(() => {})
    revalidatePath(`/dashboard/doctores/${doctorId}/agenda`)
    revalidatePath("/dashboard/turnos")
    revalidatePath("/dashboard")

    return { success: true, cancelledCount: affected.length }
  } catch (error) {
    throw new Error("No se pudo cerrar la agenda. Intente nuevamente.", { cause: error })
  }
}

export async function deleteAgendaBlock(blockId: string, doctorId: string) {
  await requireSession()

  try {
    await prisma.agendaBlock.delete({ where: { id: blockId } })
    revalidatePath(`/dashboard/doctores/${doctorId}/agenda`)
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo eliminar el bloqueo. Intente nuevamente.", { cause: error })
  }
}