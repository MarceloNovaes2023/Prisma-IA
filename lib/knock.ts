import Knock from "@knocklabs/node";

/**
 * Configuração do cliente Knock.
 * Define a chave da API Knock que será usada para todos os calls.
 * 
 * A chave deve ser definida na variável de ambiente KNOCK_API_KEY
 * no painel da conta Knock (Dashboard > Developers > API keys).
 */
const knockApiKey = process.env.KNOCK_API_KEY;

/** Obtém ou cria o cliente Knock. */
function getKnock(): Knock {
  // O construtor Knock pode receber a chave direto ou um objeto options.
  // Usamos casting para contornar diferenças de tipo entre versões.
  return new (Knock as any)(knockApiKey);
}

const knock = getKnock();

/**
 * Dispara um workflow no Knock para notificar sobre um alerta de fonte.
 * 
 * Este é o ponto de integração: sempre que o sistema de radar gera um alerta
 * (source_down, source_ok, source_error_rate), este function pode ser chamado
 * para enviar a notificação através dos canais configurados no Knock
 * (e-mail, in-app, SMS, etc.).
 * 
 * @param userId - ID do usuário/funcionário da empresa que deve receber
 * @param kind - Tipo de alerta: 'source_down', 'source_ok', 'source_error_rate'
 * @param detail - Descrição do que aconteceu
 * @param source - Fonte que gerou o alerta (bing, meta, tiktok, etc.)
 * @param crmRecordId - ID opcional do registro no CRM
 */
export async function sendKnockAlert(params: {
  userId: string;
  kind: "source_down" | "source_ok" | "source_error_rate";
  detail: string;
  source: string;
  crmRecordId?: string;
}): Promise<{ ok: boolean; workflowId?: string; error?: string }> {
  const titleMap: Record<string, string> = {
    source_down: "Fonte fora do ar",
    source_ok: "Fonte recuperada",
    source_error_rate: "Taxa de falha do alerta",
  };

  const labelMap: Record<string, string> = {
    source_down: "FORA DO AR",
    source_ok: "RECUPERADA",
    source_error_rate: "TAXA DE FALHA",
  };

  const title = `${titleMap[params.kind]} — ${params.source.toUpperCase()}`;
  const label = labelMap[params.kind];

  try {
    const result: any = await knock.workflows.trigger("radar-alert", {
      recipients: [params.userId],
      data: {
        title,
        body: params.detail,
        kind: params.kind,
        source: params.source,
        label,
        crmRecordId: params.crmRecordId,
      },
    });

    // O response do Knock pode ter a estrutura { id, name, status, etc }
    // Tentamos extrair o id de várias formas conhecidas
    let workflowId: string | undefined;
    if (result && typeof result === "object") {
      workflowId = result?.id ?? result?.workflow?.id ?? result?.data?.id;
    }

    return { ok: true, workflowId };
  } catch (error: any) {
    const msg = error?.message ?? "Erro desconhecido no Knock";
    return { ok: false, error: msg };
  }
}

/**
 * Dispara alerta de taxa de falha (error rate) para o usuário.
 * Só dispara se a taxa ultrapassar o limite configurado.
 */
export async function sendErrorRateAlert(params: {
  userId: string;
  source: string;
  failureRate: number; // percentual 0-100
  windowSize: number; // número de execuções analisadas
  minRuns: number; // mínimo para a conta valer
}): Promise<{ ok: boolean; error?: string }> {
  if (params.failureRate < 1) {
    return { ok: true };
  }

  const detail = `Taxa de falha de ${params.failureRate.toFixed(1)}% sobre as últimas ${params.windowSize} execuções (mínimo ${params.minRuns} para contabilizar).`;

  return sendKnockAlert({
    userId: params.userId,
    kind: "source_error_rate",
    detail,
    source: params.source,
  });
}

/**
 * Dispara alerta de fonte caída para o usuário.
 */
export async function sendSourceDownAlert(params: {
  userId: string;
  source: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  return sendKnockAlert({
    userId: params.userId,
    kind: "source_down",
    detail: `${params.message} — ${params.source.toUpperCase()}`,
    source: params.source,
  });
}

/**
 * Dispara alerta de fonte recuperada para o usuário.
 */
export async function sendSourceOkAlert(params: {
  userId: string;
  source: string;
  streak: number; // número de falhas seguidas antes da recuperação
}): Promise<{ ok: boolean; error?: string }> {
  const detail = `A ${params.source.toUpperCase()} voltou a sincronizar após ${params.streak} falha(s) seguida(s).`;

  return sendKnockAlert({
    userId: params.userId,
    kind: "source_ok",
    detail,
    source: params.source,
  });
}