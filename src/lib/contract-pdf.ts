import { format } from "date-fns";
import type { ContractBlock, ContractRow } from "@/hooks/useContracts";

export type ContractSignatureLike = {
  signer_name: string;
  signature_data_url: string;
  signed_at: string;
};

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blockHTML(block: ContractBlock): string {
  const text = escapeHTML(block.text ?? "").replace(/\n/g, "<br/>");
  if (block.type === "heading") {
    return `<h2>${escapeHTML(block.title || block.text || "")}</h2>`;
  }
  if (block.type === "clause") {
    return `<section class="clause">${block.title ? `<h3>${escapeHTML(block.title)}</h3>` : ""}<p>${text}</p></section>`;
  }
  return `<p>${text}</p>`;
}

function signatureCardHTML(title: string, sig: ContractSignatureLike): string {
  return `<div class="sig-card">
    <div class="sig-label">${escapeHTML(title)}</div>
    <img src="${sig.signature_data_url}" alt="Firma de ${escapeHTML(sig.signer_name)}" />
    <div class="sig-name">${escapeHTML(sig.signer_name)}</div>
    <div class="sig-date">${format(new Date(sig.signed_at), "d MMM yyyy 'a las' HH:mm")}</div>
  </div>`;
}

/**
 * Opens a new window with a printable rendering of a fully-signed contract
 * and triggers the browser's print dialog (same "Save as PDF" pattern used
 * by exportPDF() in document-export.ts, kept separate because contract
 * content is a ContractBlock[] tree, not Tiptap JSONContent).
 */
export function exportContractPDF(args: {
  contract: ContractRow;
  clientName?: string | null;
  clientSig: ContractSignatureLike;
  agencySig: ContractSignatureLike;
}): boolean {
  const { contract, clientName, clientSig, agencySig } = args;
  const w = window.open("", "_blank");
  if (!w) return false;

  const metaParts = [
    clientName ? `Contrato para ${escapeHTML(clientName)}` : null,
    `Versión ${contract.version}`,
    contract.start_date ? `Inicio ${format(new Date(contract.start_date), "d MMM yyyy")}` : null,
    contract.end_date ? `Fin ${format(new Date(contract.end_date), "d MMM yyyy")}` : null,
  ].filter(Boolean);

  const totalHTML =
    Number(contract.total_amount) > 0
      ? `<div class="total"><span>Total</span><span>${escapeHTML(contract.currency.toUpperCase())} ${Number(
          contract.total_amount,
        ).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span></div>`
      : "";

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHTML(contract.title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.6; }
  h1 { margin-bottom: 4px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 28px; }
  h2 { margin-top: 24px; color: #5140f2; }
  .clause { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin: 12px 0; }
  .clause h3 { margin: 0 0 8px; }
  .total { margin-top: 24px; border: 2px solid #5140f2; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; font-weight: 600; }
  .signatures { margin-top: 32px; display: flex; gap: 24px; }
  .sig-card { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
  .sig-label { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
  .sig-card img { max-height: 80px; max-width: 100%; }
  .sig-name { font-weight: 600; margin-top: 6px; }
  .sig-date { font-size: 12px; color: #6b7280; }
  @media print { body { margin: 20px auto; } }
</style>
</head>
<body>
<h1>${escapeHTML(contract.title)}</h1>
<p class="meta">${metaParts.join(" · ")}</p>
${contract.content.map(blockHTML).join("\n")}
${totalHTML}
<div class="signatures">
${signatureCardHTML("Firma del cliente", clientSig)}
${signatureCardHTML("Firma de la agencia", agencySig)}
</div>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
  w.focus();
  // Espera a que cargue (incluidas las imágenes de firma) y abre el diálogo de impresión
  setTimeout(() => w.print(), 400);
  return true;
}
