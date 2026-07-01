import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, Clock, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  useFetchPublicContract,
  useSignContractPublic,
  type ContractBlock,
} from "@/hooks/useContracts";
import { SignaturePad, type SignaturePadHandle } from "@/components/sales/proposals/signature-pad";

const BRAND_PRIMARY = "#5140f2";
const BRAND_SECONDARY = "#ff7503";

export default function ContractView() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError, refetch } = useFetchPublicContract(token);
  const sign = useSignContractPublic();
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

  if (isError || !data?.contract) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
        <div className="max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Contrato no encontrado</h1>
          <p className="mt-2 text-sm text-neutral-600">
            El link que abriste no es válido o ya no está disponible.
          </p>
        </div>
      </div>
    );
  }

  const { contract, client, signatures } = data;
  const clientSig = signatures.find((s) => s.signer_role === "client") ?? null;
  const agencySig = signatures.find((s) => s.signer_role === "agency") ?? null;
  const canSign =
    (contract.status === "draft" || contract.status === "sent") && !clientSig && !justSigned;

  const handleSign = async () => {
    if (!token) return;
    if (!signerName.trim()) return toast.error("Ingresá tu nombre completo");
    if (sigEmpty || !sigDataUrl) return toast.error("Dibujá tu firma");
    if (!consent) return toast.error("Confirmá el consentimiento");
    try {
      await sign.mutateAsync({
        token,
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim() || null,
        signature_data_url: sigDataUrl,
        consent: true,
      });
      setJustSigned(true);
      toast.success("¡Contrato firmado!");
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
          {client?.name && (
            <div className="text-sm uppercase tracking-widest opacity-90">
              Contrato para {client.name}
            </div>
          )}
          <h1 className="mt-2 text-3xl font-semibold">{contract.title}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm opacity-90">
            <span>Versión {contract.version}</span>
            {contract.start_date && (
              <span>Inicio {format(new Date(contract.start_date), "d MMM yyyy")}</span>
            )}
            {contract.end_date && (
              <span>Fin {format(new Date(contract.end_date), "d MMM yyyy")}</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <StatusBanner status={contract.status} clientSig={clientSig} agencySig={agencySig} />

        <div className="space-y-4">
          {contract.content.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </div>

        {Number(contract.total_amount) > 0 && (
          <div
            className="mt-6 flex items-center justify-between rounded-xl border-2 p-5"
            style={{ borderColor: BRAND_PRIMARY }}
          >
            <span className="text-sm font-medium uppercase tracking-wider text-neutral-600">
              Total
            </span>
            <span className="text-2xl font-bold" style={{ color: BRAND_PRIMARY }}>
              {contract.currency.toUpperCase()}{" "}
              {Number(contract.total_amount).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {(clientSig || agencySig) && (
          <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {clientSig && <SignatureCard title="Firma del cliente" sig={clientSig} />}
            {agencySig && <SignatureCard title="Firma de la agencia" sig={agencySig} />}
          </section>
        )}

        {canSign && (
          <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" style={{ color: BRAND_PRIMARY }} />
              <h2 className="text-lg font-semibold">Firmar contrato</h2>
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
                  Acepto los términos y confirmo mi firma electrónica de este contrato.
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
          Contrato gestionado a través de Astratta
        </footer>
      </main>
    </div>
  );
}

function StatusBanner({
  status,
  clientSig,
  agencySig,
}: {
  status: string;
  clientSig: any;
  agencySig: any;
}) {
  if (status === "cancelled")
    return (
      <Banner tone="red" icon={<XCircle className="h-5 w-5 text-red-600" />} title="Contrato cancelado">
        Este contrato ha sido cancelado.
      </Banner>
    );
  if (status === "expired")
    return (
      <Banner tone="red" icon={<Clock className="h-5 w-5 text-red-600" />} title="Contrato vencido">
        Este contrato ha expirado.
      </Banner>
    );
  if (agencySig || status === "countersigned" || status === "active" || status === "renewed")
    return (
      <Banner
        tone="emerald"
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        title="Contrato completamente firmado"
      >
        Firmado por ambas partes.
      </Banner>
    );
  if (clientSig || status === "signed_by_client")
    return (
      <Banner
        tone="amber"
        icon={<Clock className="h-5 w-5 text-amber-600" />}
        title="Firmado, pendiente de contrafirma"
      >
        Recibimos tu firma. La agencia contrafirmará en breve.
      </Banner>
    );
  return null;
}

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: "emerald" | "amber" | "red";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const bg = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
  }[tone];
  return (
    <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${bg}`}>
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm opacity-90">{children}</div>
      </div>
    </div>
  );
}

function SignatureCard({ title, sig }: { title: string; sig: any }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-2 text-xs uppercase tracking-wider text-neutral-500">{title}</div>
      <img
        src={sig.signature_data_url}
        alt={`Firma de ${sig.signer_name}`}
        className="mb-2 h-24 w-full rounded border bg-white object-contain"
      />
      <div className="text-sm font-medium">{sig.signer_name}</div>
      <div className="text-xs text-neutral-500">
        {format(new Date(sig.signed_at), "d MMM yyyy 'a las' HH:mm")}
      </div>
    </div>
  );
}

function BlockView({ block }: { block: ContractBlock }) {
  if (block.type === "heading")
    return (
      <h2 className="mt-4 text-2xl font-semibold" style={{ color: BRAND_PRIMARY }}>
        {block.title || block.text}
      </h2>
    );
  if (block.type === "clause")
    return (
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        {block.title && (
          <h3 className="mb-2 font-semibold text-neutral-900">{block.title}</h3>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
          {block.text}
        </p>
      </section>
    );
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
      {block.text}
    </p>
  );
}
