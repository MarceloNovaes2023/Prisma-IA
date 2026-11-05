import { startRadarScheduler } from "./scheduler";

/** Só deve ser importado no runtime Node — o agendador usa SQLite e node:crypto. */
export function bootRadarScheduler() {
  const result = startRadarScheduler();
  if (process.env.RADAR_SYNC_DEBUG === "1") {
    console.log(`[radar] agendador: ${result.started ? "iniciado" : "não iniciado"} (${result.reason})`);
  }
  return result;
}
