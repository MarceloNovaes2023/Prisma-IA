"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runScheduledSync } from "./scheduler";

/** Executa agora a mesma varredura que o agendador faz no intervalo. */
export async function runSchedulerAction() {
  await runScheduledSync();
  revalidatePath("/radar/fontes");
  revalidatePath("/radar/alertas");
  revalidatePath("/radar");
  redirect("/radar/fontes?agendador=1");
}
