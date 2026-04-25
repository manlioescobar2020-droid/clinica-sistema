import { PrismaClient, RoleName } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Iniciando seed...")

  // ============================================================
  // ROLES
  // ============================================================
  const roles = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  )
  console.log("✅ Roles creados:", roles.map((r) => r.name).join(", "))

  // ============================================================
  // PERMISOS
  // ============================================================
  const permissions = [
    // Appointments
    "appointment:create",
    "appointment:read",
    "appointment:update",
    "appointment:cancel",
    "appointment:attend",
    // Patients & Prospects
    "person:create",
    "person:read",
    "person:update",
    "person:delete",
    "person:change_status",
    // Doctors
    "doctor:create",
    "doctor:read",
    "doctor:update",
    "doctor:delete",
    // Secretaries
    "secretary:create",
    "secretary:read",
    "secretary:update",
    "secretary:delete",
    // Agenda
    "agenda:read",
    "agenda:block",
    "agenda:unblock",
    // Payments
    "payment:read",
    "payment:register",
    "payment:refund",
    // Medical Records
    "medical_record:create",
    "medical_record:read",
    "medical_record:update",
    "medical_record:delete",
    // Config
    "config:read",
    "config:update",
    // Reports
    "report:read",
  ]

  const createdPermissions = await Promise.all(
    permissions.map((action) =>
      prisma.permission.upsert({
        where: { action },
        update: {},
        create: { action },
      })
    )
  )
  console.log("✅ Permisos creados:", createdPermissions.length)

  // ============================================================
  // ASIGNAR PERMISOS POR ROL
  // ============================================================
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r]))
  const permMap = Object.fromEntries(createdPermissions.map((p) => [p.action, p]))

  const rolePermissions: Record<RoleName, string[]> = {
    ADMIN: permissions, // Admin tiene todo
    DOCTOR: [
      "appointment:read",
      "appointment:attend",
      "agenda:read",
      "agenda:block",
      "person:read",
      "medical_record:create",
      "medical_record:read",
      "medical_record:update",
    ],
    SECRETARY: [
      "appointment:create",
      "appointment:read",
      "appointment:update",
      "appointment:cancel",
      "appointment:attend",
      "person:create",
      "person:read",
      "person:update",
      "person:change_status",
      "agenda:read",
      "agenda:block",
      "agenda:unblock",
      "payment:read",
      "payment:register",
      "doctor:read",
      "medical_record:read",
    ],
    PATIENT: [
      "appointment:read",
      "appointment:cancel",
      "payment:read",
      "medical_record:read",
    ],
    PROSPECT: [
      "appointment:read",
    ],
  }

  for (const [roleName, perms] of Object.entries(rolePermissions)) {
    const role = roleMap[roleName as RoleName]
    await Promise.all(
      perms.map((action) =>
        prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permMap[action].id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permMap[action].id,
          },
        })
      )
    )
  }
  console.log("✅ Permisos asignados por rol")

  // ============================================================
  // USUARIO ADMIN POR DEFECTO
  // ============================================================
  const adminRole = roleMap[RoleName.ADMIN]
  const hashedPassword = await bcrypt.hash("Admin1234!", 12)

  const admin = await prisma.user.upsert({
    where: { email: "admin@clinica.com" },
    update: {},
    create: {
      email: "admin@clinica.com",
      password: hashedPassword,
      name: "Administrador",
      roleId: adminRole.id,
    },
  })
  console.log("✅ Admin creado:", admin.email)

  // ============================================================
  // CONFIGURACIÓN INICIAL DE LA CLÍNICA
  // ============================================================
  const existingConfig = await prisma.clinicConfig.findFirst()
  if (!existingConfig) {
    await prisma.clinicConfig.create({
      data: {
        name: "Mi Clínica",
        timezone: "America/Argentina/Buenos_Aires",
        currency: "ARS",
      },
    })
    console.log("✅ Configuración de clínica creada")
  }

  // ============================================================
  // OBRAS SOCIALES
  // ============================================================
  const obrasSociales = ["Particular", "OSDE", "Swiss Medical", "IOMA", "Sancor Salud"]

  await Promise.all(
    obrasSociales.map((name) =>
      prisma.healthInsurance.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  )
  console.log("✅ Obras sociales creadas:", obrasSociales.join(", "))

  console.log("🎉 Seed completado exitosamente")
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })