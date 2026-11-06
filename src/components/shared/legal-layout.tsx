import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";

export type LegalLang = "es" | "en";

export const LEGAL_CONTACT_EMAIL = "info@astrattaagency.com";

export function useLegalLang(): [LegalLang, (lang: LegalLang) => void] {
  const [params, setParams] = useSearchParams();
  const lang: LegalLang = params.get("lang") === "en" ? "en" : "es";
  const setLang = (next: LegalLang) => {
    const updated = new URLSearchParams(params);
    if (next === "en") updated.set("lang", "en");
    else updated.delete("lang");
    setParams(updated, { replace: true });
  };
  return [lang, setLang];
}

const NAV = {
  es: { privacy: "Política de privacidad", deletion: "Eliminación de datos" },
  en: { privacy: "Privacy policy", deletion: "Data deletion" },
};

export function LegalLayout({
  lang,
  onLangChange,
  children,
}: {
  lang: LegalLang;
  onLangChange: (lang: LegalLang) => void;
  children: ReactNode;
}) {
  const query = lang === "en" ? "?lang=en" : "";
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Logo />
          <div className="flex gap-1 text-sm" role="group" aria-label="Idioma / Language">
            {(["es", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onLangChange(option)}
                aria-pressed={lang === option}
                className={`rounded px-2 py-1 uppercase ${
                  lang === option
                    ? "bg-neutral-200 font-semibold text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </header>
        <main className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
          {children}
        </main>
        <footer className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
          <Link to={`/privacidad${query}`} className="hover:underline">
            {NAV[lang].privacy}
          </Link>
          <Link to={`/eliminacion-datos${query}`} className="hover:underline">
            {NAV[lang].deletion}
          </Link>
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="hover:underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
        </footer>
      </div>
    </div>
  );
}
