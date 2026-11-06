import { LegalLayout, LEGAL_CONTACT_EMAIL, useLegalLang } from "@/components/shared/legal-layout";

interface Section {
  heading: string;
  body?: string;
  items?: string[];
}

const CONTENT: Record<"es" | "en", { title: string; updated: string; sections: Section[] }> = {
  es: {
    title: "Política de privacidad",
    updated: "Última actualización: 1 de noviembre de 2026",
    sections: [
      {
        heading: "Quiénes somos",
        body: "Astratta Agency opera Astratta OS, una plataforma con la que las agencias gestionan clientes, contenido, aprobaciones, facturación y reportes. Esta política explica qué datos tratamos, para qué y qué opciones tienes.",
      },
      {
        heading: "Datos que tratamos",
        items: [
          "Cuenta: nombre, correo electrónico y datos de perfil de los usuarios del equipo y del portal de clientes.",
          "Datos de trabajo: información de clientes, proyectos, contenido, documentos, contratos y facturas que la agencia registra en la plataforma.",
          "Cuentas de redes sociales conectadas: identificadores de la cuenta y del usuario que autoriza, nombre, usuario, foto de perfil, seguidores, publicaciones, métricas de rendimiento y datos agregados de audiencia (por ejemplo, edad, género o país). No recibimos datos que identifiquen a cada seguidor.",
          "Credenciales de acceso a esas plataformas: los tokens de autorización y los permisos concedidos.",
        ],
      },
      {
        heading: "Para qué los usamos",
        items: [
          "Mostrar a la agencia y a su cliente paneles de métricas y reportes periódicos de las cuentas conectadas.",
          "Operar las funciones de la plataforma, enviar avisos del servicio y mantener la seguridad.",
        ],
      },
      {
        heading: "Facebook, Instagram y TikTok",
        body: "Solo accedemos a estas plataformas cuando una persona con permisos sobre la cuenta lo autoriza, y únicamente para leer los datos descritos arriba. No vendemos estos datos ni los usamos para publicidad. Puedes retirar el acceso en cualquier momento desde la configuración de integraciones de cada plataforma o escribiéndonos.",
      },
      {
        heading: "Con quién los compartimos",
        body: "Los datos de un cliente solo son visibles para su agencia y para los usuarios del portal de ese cliente. Usamos proveedores que tratan datos en nuestro nombre para prestar el servicio: Supabase (base de datos y almacenamiento), Vercel (alojamiento), Stripe (pagos), Google (sincronización de calendario, si se activa) y Resend y Amazon SES (correo). No vendemos datos personales.",
      },
      {
        heading: "Seguridad",
        body: "Los tokens de acceso se guardan cifrados y no se muestran en la aplicación. El acceso a los datos está restringido por agencia y por rol.",
      },
      {
        heading: "Conservación y eliminación",
        body: "Conservamos los datos mientras la cuenta o la conexión estén activas y sean necesarios para prestar el servicio. Al eliminar una conexión borramos sus tokens y las métricas asociadas. Consulta cómo solicitarlo en la página de eliminación de datos, enlazada al final de esta página.",
      },
      {
        heading: "Tus derechos",
        body: `Puedes pedir acceso, corrección o eliminación de tus datos escribiendo a ${LEGAL_CONTACT_EMAIL}. Responderemos en un máximo de 30 días.`,
      },
      {
        heading: "Cambios",
        body: "Si esta política cambia, publicaremos aquí la nueva versión con su fecha de actualización.",
      },
    ],
  },
  en: {
    title: "Privacy policy",
    updated: "Last updated: November 1, 2026",
    sections: [
      {
        heading: "Who we are",
        body: "Astratta Agency operates Astratta OS, a platform agencies use to manage clients, content, approvals, billing and reports. This policy explains what data we process, why, and the choices you have.",
      },
      {
        heading: "Data we process",
        items: [
          "Account: name, email address and profile details of team and client portal users.",
          "Work data: client, project, content, document, contract and invoice information the agency records in the platform.",
          "Connected social media accounts: identifiers of the account and of the authorizing user, name, username, profile picture, follower counts, posts, performance metrics and aggregated audience data (for example age, gender or country). We do not receive data identifying individual followers.",
          "Access credentials for those platforms: authorization tokens and the permissions granted.",
        ],
      },
      {
        heading: "How we use it",
        items: [
          "To show the agency and its client metrics dashboards and periodic reports for the connected accounts.",
          "To operate the platform, send service notices and maintain security.",
        ],
      },
      {
        heading: "Facebook, Instagram and TikTok",
        body: "We only access these platforms when a person with permissions over the account authorizes it, and only to read the data described above. We do not sell this data or use it for advertising. You can withdraw access at any time from each platform's integration settings or by contacting us.",
      },
      {
        heading: "Who we share it with",
        body: "A client's data is only visible to its agency and to that client's portal users. We use providers that process data on our behalf to deliver the service: Supabase (database and storage), Vercel (hosting), Stripe (payments), Google (calendar sync, if enabled), and Resend and Amazon SES (email). We do not sell personal data.",
      },
      {
        heading: "Security",
        body: "Access tokens are stored encrypted and are not displayed in the application. Data access is restricted by agency and role.",
      },
      {
        heading: "Retention and deletion",
        body: "We keep data while the account or connection is active and needed to deliver the service. When a connection is deleted, we erase its tokens and associated metrics. See how to request this on the data deletion page, linked at the bottom of this page.",
      },
      {
        heading: "Your rights",
        body: `You can request access to, correction of or deletion of your data by writing to ${LEGAL_CONTACT_EMAIL}. We will respond within 30 days.`,
      },
      {
        heading: "Changes",
        body: "If this policy changes, we will publish the new version here with its update date.",
      },
    ],
  },
};

export default function Privacy() {
  const [lang, setLang] = useLegalLang();
  const content = CONTENT[lang];

  return (
    <LegalLayout lang={lang} onLangChange={setLang}>
      <h1 className="text-2xl font-bold text-neutral-900">{content.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{content.updated}</p>
      {content.sections.map((section) => (
        <section key={section.heading} className="mt-6">
          <h2 className="text-lg font-semibold text-neutral-900">{section.heading}</h2>
          {section.body && <p className="mt-2 leading-relaxed">{section.body}</p>}
          {section.items && (
            <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </LegalLayout>
  );
}
