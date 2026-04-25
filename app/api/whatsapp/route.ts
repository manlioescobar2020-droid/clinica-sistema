import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const FROM = process.env.TWILIO_WHATSAPP_FROM!;

async function sendMessage(to: string, body: string) {
  await client.messages.create({ from: FROM, to, body });
}

const DIAS_SEMANA: Record<string, string> = {
  MONDAY: "Lunes", TUESDAY: "Martes", WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves", FRIDAY: "Viernes", SATURDAY: "Sábado", SUNDAY: "Domingo"
};

const DIAS_EN: Record<number, string> = {
  0: "SUNDAY", 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY",
  4: "THURSDAY", 5: "FRIDAY", 6: "SATURDAY"
};

function parseFecha(texto: string): Date | null {
  const partes = texto.split("/");
  if (partes.length !== 3) return null;
  const [dia, mes, anio] = partes.map(Number);
  if (!dia || !mes || !anio) return null;
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getDate() !== dia || fecha.getMonth() !== mes - 1) return null;
  return fecha;
}

function generarSlots(startTime: string, endTime: string, duracion: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let minutos = sh * 60 + sm;
  const fin = eh * 60 + em;
  while (minutos + duracion <= fin) {
    const h = Math.floor(minutos / 60).toString().padStart(2, "0");
    const m = (minutos % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    minutos += duracion;
  }
  return slots;
}

const sessions: Record<string, any> = {};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const from = formData.get("From") as string;
  const body = (formData.get("Body") as string)?.trim();
  const bodyLower = body?.toLowerCase();

  if (bodyLower === "menu" || bodyLower === "hola" || bodyLower === "inicio") {
    sessions[from] = { step: "inicio" };
  }

  if (!sessions[from]) {
    sessions[from] = { step: "inicio" };
  }

  const session = sessions[from];

  try {
    // PASO 1 — Saludo
    if (session.step === "inicio") {
      sessions[from].step = "esperando_nombre";
      await sendMessage(from, "👋 Bienvenido a la clínica. Por favor, escribí tu *nombre completo* para continuar.");
      return NextResponse.json({ ok: true });
    }

    // PASO 2 — Nombre
    if (session.step === "esperando_nombre") {
      sessions[from].nombre = body;
      sessions[from].step = "esperando_dni";
      await sendMessage(from, `Gracias, ${body}. Ahora escribí tu *número de DNI*.`);
      return NextResponse.json({ ok: true });
    }

    // PASO 3 — DNI
    if (session.step === "esperando_dni") {
      sessions[from].dni = body;

      const persona = await prisma.person.findFirst({
        where: { dni: body },
      });

      if (persona) {
        sessions[from].personId = persona.id;
      }

      const especialidades = await prisma.specialty.findMany({
        orderBy: { name: "asc" },
      });

      const lista = especialidades.map((e: any, i: number) => `${i + 1}. ${e.name}`).join("\n");
      sessions[from].especialidades = especialidades;
      sessions[from].step = "esperando_especialidad";

      await sendMessage(from, `¿Qué especialidad necesitás?\n\n${lista}\n\nRespondé con el *número* de la especialidad.`);
      return NextResponse.json({ ok: true });
    }

    // PASO 4 — Especialidad
    if (session.step === "esperando_especialidad") {
      const index = parseInt(bodyLower) - 1;
      const especialidades = session.especialidades;

      if (isNaN(index) || index < 0 || index >= especialidades.length) {
        await sendMessage(from, "Por favor respondé con el número de la especialidad.");
        return NextResponse.json({ ok: true });
      }

      const especialidad = especialidades[index];
      sessions[from].especialidadId = especialidad.id;
      sessions[from].step = "esperando_doctor";

      const doctores = await prisma.doctor.findMany({
        where: {
          specialties: {
            some: { specialtyId: especialidad.id },
          },
        },
        include: { user: true },
      });

      if (doctores.length === 0) {
        sessions[from].step = "esperando_especialidad";
        await sendMessage(from, "No hay doctores disponibles para esa especialidad.\n\nElegí otra especialidad:\n\n" + especialidades.map((e: any, i: number) => `${i + 1}. ${e.name}`).join("\n") + "\n\nRespondé con el *número* o escribí *menu* para empezar de nuevo.");
        return NextResponse.json({ ok: true });
      }

      const lista = doctores.map((d: any, i: number) => `${i + 1}. ${d.user.name}`).join("\n");
      sessions[from].doctores = doctores;

      await sendMessage(from, `Doctores disponibles:\n\n${lista}\n\nRespondé con el *número* del doctor.`);
      return NextResponse.json({ ok: true });
    }

    // PASO 5 — Doctor
    if (session.step === "esperando_doctor") {
      const index = parseInt(bodyLower) - 1;
      const doctores = session.doctores;

      if (isNaN(index) || index < 0 || index >= doctores.length) {
        await sendMessage(from, "Por favor respondé con el número del doctor.");
        return NextResponse.json({ ok: true });
      }

      const doctor = doctores[index];
      sessions[from].doctorId = doctor.id;
      sessions[from].doctorNombre = doctor.user.name;
      sessions[from].step = "esperando_fecha";

      await sendMessage(from, `Elegiste al Dr/a. ${doctor.user.name}.\n\n¿Para qué fecha necesitás el turno?\n\nRespondé con la fecha en formato *DD/MM/AAAA* (ej: 28/04/2026).`);
      return NextResponse.json({ ok: true });
    }

    // PASO 6 — Fecha y mostrar horarios disponibles
    if (session.step === "esperando_fecha") {
      const fecha = parseFecha(body);

      if (!fecha) {
        await sendMessage(from, "Formato de fecha incorrecto. Usá *DD/MM/AAAA* (ej: 28/04/2026).");
        return NextResponse.json({ ok: true });
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (fecha < hoy) {
        await sendMessage(from, "La fecha no puede ser anterior a hoy. Ingresá otra fecha.");
        return NextResponse.json({ ok: true });
      }

      const diaSemana = DIAS_EN[fecha.getDay()];
      const doctorId = session.doctorId;

      // Buscar horarios del doctor para ese día
      const horarios = await prisma.doctorSchedule.findMany({
        where: {
          doctorId,
          dayOfWeek: diaSemana as any,
          active: true,
        },
      });

      if (horarios.length === 0) {
        await sendMessage(from, `El Dr/a. ${session.doctorNombre} no atiende los ${DIAS_SEMANA[diaSemana]}. Elegí otra fecha.`);
        return NextResponse.json({ ok: true });
      }

      // Verificar bloqueos de agenda
      const inicioDelDia = new Date(fecha);
      inicioDelDia.setHours(0, 0, 0, 0);
      const finDelDia = new Date(fecha);
      finDelDia.setHours(23, 59, 59, 999);

      const bloqueos = await prisma.agendaBlock.findMany({
        where: {
          doctorId,
          date: { gte: inicioDelDia, lte: finDelDia },
        },
      });

      // Verificar si hay bloqueo de día completo
      const bloqueoDiaCompleto = bloqueos.find((b: any) => !b.startTime && !b.endTime);
      if (bloqueoDiaCompleto) {
        await sendMessage(from, `El Dr/a. ${session.doctorNombre} no está disponible ese día (${bloqueoDiaCompleto.reason}). Elegí otra fecha.`);
        return NextResponse.json({ ok: true });
      }

      // Buscar turnos ya tomados
      const turnosExistentes = await prisma.appointment.findMany({
        where: {
          doctorId,
          startTime: { gte: inicioDelDia, lte: finDelDia },
          status: { notIn: ["CANCELLED_PATIENT", "CANCELLED_CLINIC"] },
        },
      });

      const horasTomadas = turnosExistentes.map((t: any) => {
        const d = new Date(t.startTime);
        return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
      });

      // Generar slots disponibles
      let todosLosSlots: { hora: string; duracion: number; scheduleId: string }[] = [];

      for (const horario of horarios) {
        // Filtrar por bloqueos parciales
        const bloqueado = bloqueos.some((b: any) => {
          if (!b.startTime || !b.endTime) return false;
          return horario.startTime < b.endTime && horario.endTime > b.startTime;
        });
        if (bloqueado) continue;

        const slots = generarSlots(horario.startTime, horario.endTime, horario.slotDuration);
        for (const slot of slots) {
          if (!horasTomadas.includes(slot)) {
            todosLosSlots.push({ hora: slot, duracion: horario.slotDuration, scheduleId: horario.id });
          }
        }
      }

      if (todosLosSlots.length === 0) {
        await sendMessage(from, `No hay horarios disponibles para el Dr/a. ${session.doctorNombre} en esa fecha. Probá con otra fecha.`);
        return NextResponse.json({ ok: true });
      }

      todosLosSlots.sort((a, b) => a.hora.localeCompare(b.hora));

      const lista = todosLosSlots.map((s, i) => `${i + 1}. ${s.hora} hs`).join("\n");
      sessions[from].slots = todosLosSlots;
      sessions[from].fecha = fecha;
      sessions[from].step = "esperando_horario";

      const fechaStr = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`;
      await sendMessage(from, `Horarios disponibles para el ${fechaStr} con ${session.doctorNombre}:\n\n${lista}\n\nRespondé con el *número* del horario.`);
      return NextResponse.json({ ok: true });
    }

    // PASO 7 — Seleccionar horario y confirmar turno
    if (session.step === "esperando_horario") {
      const index = parseInt(bodyLower) - 1;
      const slots = session.slots;

      if (isNaN(index) || index < 0 || index >= slots.length) {
        await sendMessage(from, "Por favor respondé con el número del horario.");
        return NextResponse.json({ ok: true });
      }

      const slotElegido = slots[index];
      const fecha = new Date(session.fecha);
      const [h, m] = slotElegido.hora.split(":").map(Number);
      const startTime = new Date(fecha);
      startTime.setHours(h, m, 0, 0);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + slotElegido.duracion);

      // Si no existe la persona, crearla como prospecto
      let personId = session.personId;
      if (!personId) {
        const nuevoUser = await prisma.user.create({
          data: {
            name: session.nombre,
            email: `prospecto_${session.dni}@clinica.temp`,
            password: "temporal",
            role: { connect: { name: "PROSPECT" } },
          },
        });

        const nuevaPersona = await prisma.person.create({
          data: {
            userId: nuevoUser.id,
            firstName: session.nombre.split(" ")[0] || session.nombre,
            lastName: session.nombre.split(" ").slice(1).join(" ") || "",
            dni: session.dni,
            phone: from.replace("whatsapp:", ""),
            status: "PROSPECT",
          },
        });

        personId = nuevaPersona.id;
        sessions[from].personId = personId;
      }

      // Crear el turno
      const turno = await prisma.appointment.create({
        data: {
          personId,
          doctorId: session.doctorId,
          scheduleId: slotElegido.scheduleId,
          startTime,
          endTime,
          status: "RESERVED",
        },
      });

      const fechaStr = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`;

      const mensaje = `✅ *Tu turno fue registrado exitosamente*\n\n` +
        `👤 Paciente: ${session.nombre}\n` +
        `🩺 Doctor/a: ${session.doctorNombre}\n` +
        `📅 Fecha: ${fechaStr}\n` +
        `🕐 Horario: ${slotElegido.hora} hs\n\n` +
        `📋 *Términos y condiciones:*\n` +
        `• Podés cancelar tu turno hasta *24 horas antes* sin cargo.\n` +
        `• Si no asistís sin cancelar, se registrará como *ausencia*.\n` +
        `• El pago anticipado vía Mercado Pago *confirma* tu turno y tiene prioridad.\n` +
        `• Si el médico cancela, serás notificado y se *reembolsará* cualquier pago realizado.\n` +
        `• Te enviaremos un *recordatorio 24hs antes* del turno.\n\n` +
        `¿Necesitás algo más? Escribí *menu* para hacer otra consulta.`;

      await sendMessage(from, mensaje);
      sessions[from] = { step: "inicio" };
      return NextResponse.json({ ok: true });
    }

    await sendMessage(from, "No entendí tu mensaje. Escribí *menu* para empezar de nuevo.");
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Error:", error);
    await sendMessage(from, "Hubo un error. Intentá de nuevo más tarde.");
    return NextResponse.json({ ok: false });
  }
}
