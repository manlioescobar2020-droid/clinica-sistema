import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const dni = req.nextUrl.searchParams.get("dni")
  if (!dni) return NextResponse.json({ error: "DNI requerido" }, { status: 400 })

  const person = await prisma.person.findFirst({
    where: {
      dni,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dni: true,
      phone: true,
      status: true,
    },
  })

  if (!person) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  return NextResponse.json(person)
}