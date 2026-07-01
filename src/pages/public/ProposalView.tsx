import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  useFetchPublicProposal,
  useSignProposal,
  type ProposalBlock,
} from "@/hooks/useProposals";
import { SignaturePad, type SignaturePadHandle } from "@/components/sales/proposals/signature-pad";

const BRAND_PRIMARY = "#5140f2";
const BRAND_SECONDARY = "#ff7503";

export default function ProposalView() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError, refetch } = useFetchPublicProposal(token);
  const sign = useSignProposal();
  const padRef = useRef<SignaturePadHandle>(null);

  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sigDataUrl, setSigDataUrl] = useState("");
  const [sigEmpty, setSigEmpty] = useState(true);
  const [justSigned, setJustSigned] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND_PRIMARY }} />
      </div>
    );
  }

  if (isError || !data?.proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
        <div className="max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Propuesta no encontrada</h1>
          <p className="mt-2 text-sm text-neutral-600">
            El link que abriste no es válido o ya no está disponible. Contactá a quien te envió esta propuesta.
          </p>
        </div>
      </div>
    );
  }

  const { proposal, lead, signature } = data;
  const isSigned = proposal.status === "signed" || !!signature;

  const handleSign = async () => {
    if (!token) return;
    if (!signerName.trim()) {
      toast.error("Ingresá tu nombre completo");
      return;
    }
    if (sigEmpty || !sigDataUrl) {
      toast.error("Dibujá tu firma");
      return;
    }
    if (!consent) {
      toast.error("Confirmá el consentimiento");
      return;
    }
    try {
      await sign.mutateAsync({
        token,
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim() || null,
        signature_data_url: sigDataUrl,
        consent: true,
      });
      setJustSigned(true);
      toast.success("¡Propuesta firmada!");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo firmar");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header
        className="border-b"
        style={{
          background: `linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_SECONDARY} 100%)`,
        }}
      >
        <div className="mx-auto max-w-3xl px-6 py-10 text-white">
          {lead?.company_name && (
            <div className="text-sm uppercase tracking-widest opacity-90">
              Propuesta para {lead.company_name}
            </div>
          )}
          <h1 className="mt-2 text-3xl font-semibold">{proposal.title}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm opacity-90">
            <span>Versión {proposal.version}</span>
            {proposal.valid_until && (
              <span>Válida hasta {format(new Date(proposal.valid_until), "d MMM yyyy")}</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {(isSigned || justSigned) && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            <div>
              <div className="font-medium text-emerald-900">Propuesta firmada</div>
              {signature ? (
                <div className="text-sm text-emerald-800">
                  Firmada por <strong>{signature.signer_name}</strong> el{" "}
                  {format(new Date(signature.signed_at), "d MMM yyyy 'a las' HH:mm")}.
                </div>
              ) : (
                <div className="text-sm text-emerald-800">Gracias por firmar la propuesta.</div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {proposal.content.map((b) => (
            <BlockView key={b.id} block={b} currency={proposal.currency} />
          ))}
        </div>

        <div
          className="mt-6 flex items-center justify-between rounded-xl border-2 p-5"
          style={{ borderColor: BRAND_PRIMARY }}
        >
          <span className="text-sm font-medium uppercase tracking-wider text-neutral-600">Total</span>
          <span className="text-2xl font-bold" style={{ color: BRAND_PRIMARY }}>
            {proposal.currency.toUpperCase()}{" "}
            {Number(proposal.total_amount).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
          </span>
        </div>

        {!isSigned && !justSigned && (
          <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" style={{ color: BRAND_PRIMARY }} />
              <h2 className="text-lg font-semibold">Firmar propuesta</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label>Nombre completo</Label>
                  <Input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Tu nombre y apellido"
                  />
                </div>
                <div>
                  <Label>Email (opcional)</Label>
                  <Input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              <div>
                <Label>Firma</Label>
                <SignaturePad
                  ref={padRef}
                  color={BRAND_PRIMARY}
                  onChange={(url, empty) => {
                    setSigDataUrl(url);
                    setSigEmpty(empty);
                  }}
                />
              </div>

              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5"
                />
                <span className="text-neutral-700">
                  Acepto los términos y confirmo mi firma electrónica de esta propuesta.
                </span>
              </label>

              <Button
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: BRAND_PRIMARY }}
                onClick={handleSign}
                disabled={sign.isPending || !consent || sigEmpty || !signerName.trim()}
              >
                {sign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Firmar y aceptar
              </Button>
            </div>
          </section>
        )}

        <footer className="mt-10 text-center text-xs text-neutral-500">
          Propuesta enviada a través de Astratta
        </footer>
      </main>
    </div>
  );
}

function BlockView({ block, currency }: { block: ProposalBlock; currency: string }) {
  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="mb-3 text-lg font-semibold" style={{ color: BRAND_PRIMARY }}>
        {block.title}
      </h3>
      {block.type === "text" && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{block.body}</p>
      )}
      {block.type === "services" && (
        <ul className="space-y-3">
          {block.items.map((it, i) => (
            <li key={i} className="border-l-2 pl-3" style={{ borderColor: BRAND_SECONDARY }}>
              <div className="font-medium text-neutral-900">{it.name}</div>
              {it.description && <div className="text-sm text-neutral-600">{it.description}</div>}
            </li>
          ))}
        </ul>
      )}
      {block.type === "deliverables" && (
        <ul className="space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: BRAND_PRIMARY }} />
              {it.label}
            </li>
          ))}
        </ul>
      )}
      {block.type === "timeline" && (
        <ul className="space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="flex items-center justify-between border-b py-2 last:border-b-0 text-sm">
              <span className="font-medium">{it.name}</span>
              <span className="text-neutral-500">{it.when}</span>
            </li>
          ))}
        </ul>
      )}
      {block.type === "pricing" && (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="pb-2 text-left">Concepto</th>
              <th className="pb-2 text-right">Cant.</th>
              <th className="pb-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {block.items.map((it, i) => (
              <tr key={i} className="border-t">
                <td className="py-2">{it.name}</td>
                <td className="py-2 text-right">{it.quantity}</td>
                <td className="py-2 text-right tabular-nums">
                  {currency.toUpperCase()}{" "}
                  {(it.quantity * it.unit_price).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
