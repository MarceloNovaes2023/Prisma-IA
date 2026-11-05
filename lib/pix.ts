/**
 * Gerador de BR Code PIX (EMV MPM) com CRC16-CCITT.
 * Serve para exibir o "copia e cola" sem depender de SDK.
 */

export type PixPayloadInput = {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid: string;
  description?: string;
};

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC16/CCITT-FALSE, exigido pelo padrão PIX. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index++) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 .-]/g, "")
    .slice(0, max)
    .toUpperCase();
}

export function buildPixPayload(input: PixPayloadInput): string {
  const merchantAccount =
    field("00", "BR.GOV.BCB.PIX") +
    field("01", input.key) +
    (input.description ? field("02", sanitize(input.description, 40)) : "");

  const payload =
    field("00", "01") +
    field("01", "11") + // QR estático reutilizável
    field("26", merchantAccount) +
    field("52", "0000") +
    field("53", "986") +
    field("54", input.amount.toFixed(2)) +
    field("58", "BR") +
    field("59", sanitize(input.merchantName, 25)) +
    field("60", sanitize(input.merchantCity, 15)) +
    field("62", field("05", sanitize(input.txid, 25) || "***"));

  const withCrcId = `${payload}6304`;
  return `${withCrcId}${crc16(withCrcId)}`;
}

/** Payload de demonstração: chave fictícia, não movimenta dinheiro. */
export function sandboxPix(input: {
  amount: number;
  txid: string;
  merchantName?: string;
  merchantCity?: string;
  description?: string;
}): string {
  return buildPixPayload({
    key: process.env.PIX_KEY?.trim() || "pagamentos@fluxo.demo",
    merchantName: input.merchantName ?? process.env.PIX_MERCHANT_NAME ?? "FLUXO PAGAMENTOS",
    merchantCity: input.merchantCity ?? process.env.PIX_MERCHANT_CITY ?? "SAO PAULO",
    amount: input.amount,
    txid: input.txid,
    description: input.description,
  });
}
