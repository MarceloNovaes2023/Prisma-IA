/**
 * Hook de inicialização do Next. O import fica dentro da checagem positiva de
 * NEXT_RUNTIME === "nodejs" para que o bundle de edge/browser descarte o módulo
 * (ele depende de node:sqlite e node:crypto).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootRadarScheduler } = await import("./lib/radar/instrumentation-node");
    await bootRadarScheduler();
  }
}
