"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { RoleName, PersonStatus, AuditAction } from "@prisma/client"
import { createAuditLog } from "@/lib/audit"

// ============================================================
// HELPERS
// ============================================================

async function requireStaff() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("No autorizado")
  const allowed = [RoleName.ADMIN, RoleName.SECRETARY]
  if (!allowed.includes(session.user.role as RoleName)) {
    throw new Error("No autorizado")
  }
  return session
}

// ============================================================
// OBTENER TODAS LAS PERSONAS
// ============================================================

export async function getPersons(search?: string, status?: PersonStatus) {
  return prisma.person.findMany({
    where: {
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { dni: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
  })
}

// ============================================================
// OBTENER UNA PERSONA
// ============================================================

export async function getPersonById(id: string) {
  return prisma.person.findFirst({
    where: { id, deletedAt: null },
    include: {
      appointments: {
        orderBy: { startTime: "desc" },
        take: 10,
        include: {
          doctor: {
            include: { user: { select: { name: true } } },
          },
          payment: true,
        },
      },
    },
  })
}

// ============================================================
// CREAR PERSONA
// ============================================================

export async function createPerson(formData: FormData) {
  const session = await requireStaff()

  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const dni = formData.get("dni") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const birthDate = formData.get("birthDate") as string
  const notes = formData.get("notes") as string

  const existing = await prisma.person.findUnique({ where: { dni } })
  if (existing) throw new Error("Ya existe una persona con ese DNI")

  try {
    let userId: string | undefined

    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (!existingUser) {
        const prospectRole = await prisma.role.findUnique({
          where: { name: RoleName.PROSPECT },
        })
        if (prospectRole) {
          const tempPassword = await bcrypt.hash(dni, 12)
          const user = await prisma.user.create({
            data: {
              name: `${firstName} ${lastName}`,
              email,
              password: tempPassword,
              roleId: prospectRole.id,
            },
          })
          userId = user.id
        }
      }
    }

    const person = await prisma.person.create({
      data: {
        firstName,
        lastName,
        dni,
        email: email || null,
        phone: phone || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        notes: notes || null,
        userId: userId || null,
      },
    })

    await createAuditLog({
      performedBy: session.user.id,
      entity: "Person",
      entityId: person.id,
      action: AuditAction.CREATE,
      newData: { firstName, lastName, dni, phone: phone || null, email: email || null },
    }).catch(() => {})
    revalidatePath("/dashboard/personas")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo crear el paciente. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// EDITAR PERSONA
// ============================================================

export async function updatePerson(id: string, formData: FormData) {
  const session = await requireStaff()

  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const dni = formData.get("dni") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const birthDate = formData.get("birthDate") as string
  const notes = formData.get("notes") as string

  const previous = await prisma.person.findUnique({
    where: { id },
    select: { firstName: true, lastName: true, dni: true, phone: true, email: true },
  })

  const dniConflict = await prisma.person.findFirst({ where: { dni, NOT: { id } } })
  if (dniConflict) throw new Error("Ya existe otra persona con ese DNI")

  try {
    await prisma.person.update({
      where: { id },
      data: {
        firstName,
        lastName,
        dni,
        email: email || null,
        phone: phone || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        notes: notes || null,
      },
    })

    await createAuditLog({
      performedBy: session.user.id,
      entity: "Person",
      entityId: id,
      action: AuditAction.UPDATE,
      previousData: previous ?? undefined,
      newData: { firstName, lastName, dni, phone: phone || null, email: email || null },
    }).catch(() => {})
    revalidatePath("/dashboard/personas")
    revalidatePath(`/dashboard/personas/${id}`)
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo actualizar el paciente. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// CREAR PROSPECTO RÁPIDO (desde alta de turno)
// ============================================================

export async function createProspect(formData: FormData) {
  const session = await requireStaff()

  const firstName = (formData.get("firstName") as string)?.trim()
  const lastName  = (formData.get("lastName")  as string)?.trim()
  const dni       = (formData.get("dni")       as string)?.trim()
  const phone     = (formData.get("phone")     as string)?.trim()
  const email     = (formData.get("email")     as string)?.trim()

  if (!firstName || !lastName || !dni) throw new Error("Nombre, apellido y DNI son obligatorios")

  const existing = await prisma.person.findUnique({ where: { dni } })
  if (existing) throw new Error("Ya existe una persona con ese DNI")

  try {
    const person = await prisma.person.create({
      data: { firstName, lastName, dni, phone: phone || null, email: email || null },
    })

    await createAuditLog({
      performedBy: session.user.id,
      entity: "Person",
      entityId: person.id,
      action: AuditAction.CREATE,
      newData: { firstName, lastName, dni, phone: phone || null, email: email || null, origin: "prospecto-rapido" },
    }).catch(() => {})

    revalidatePath("/dashboard/personas")
    return { success: true as const, personId: person.id, fullName: `${firstName} ${lastName}` }
  } catch (error) {
    throw new Error("No se pudo crear el prospecto. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// CAMBIAR ESTADO
// ============================================================

export async function changePersonStatus(id: string, status: PersonStatus) {
  await requireStaff()

  try {
    await prisma.person.update({ where: { id }, data: { status } })
    revalidatePath("/dashboard/personas")
    revalidatePath(`/dashboard/personas/${id}`)
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo cambiar el estado. Intente nuevamente.", { cause: error })
  }
}

// ============================================================
// SOFT DELETE
// ============================================================

export async function deletePerson(id: string) {
  await requireStaff()

  try {
    await prisma.person.update({ where: { id }, data: { deletedAt: new Date() } })
    revalidatePath("/dashboard/personas")
    return { success: true }
  } catch (error) {
    throw new Error("No se pudo eliminar el paciente. Intente nuevamente.", { cause: error })
  }
}