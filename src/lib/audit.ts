import { prisma } from "@/lib/prisma"
import { AuditAction } from "@prisma/client"

export async function createAuditLog({
  performedBy,
  entity,
  entityId,
  action,
  previousData,
  newData,
}: {
  performedBy?: string | null
  entity: string
  entityId: string
  action: AuditAction
  previousData?: Record<string, unknown>
  newData?: Record<string, unknown>
}) {
  try {
    await prisma.auditLog.create({
      data: {
        performedBy: performedBy ?? undefined,
        entity,
        entityId,
        action,
        previousData: previousData as object | undefined,
        newData: newData as object | undefined,
      },
    })
  } catch (error) {
    // El audit nunca debe romper el flujo principal
    console.error("[AuditLog] Error al registrar:", error)
  }
}
