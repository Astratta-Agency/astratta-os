import { Construction } from "lucide-react";

interface Props {
  section: string;
}

export default function PortalComingSoon({ section }: Props) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: "color-mix(in srgb, var(--portal-primary) 12%, transparent)" }}
      >
        <Construction className="h-8 w-8" style={{ color: "var(--portal-primary)" }} />
      </div>
      <h1 className="font-display text-2xl font-bold">{section}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Próximamente. Tu equipo en Astratta está trabajando en esta sección.
      </p>
    </div>
  );
}
