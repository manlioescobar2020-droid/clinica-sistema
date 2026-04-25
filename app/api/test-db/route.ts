import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.person.count();
    return NextResponse.json({ ok: true, count });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
