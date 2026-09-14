# Radiografía de Astratta OS

**Fecha del análisis original:** 8 de agosto de 2026
**Fecha de esta actualización:** 8 de agosto de 2026 (mismo día, tras ejecutar la Fase 0)
**Alcance:** análisis completo del estado del sistema y roadmap hacia SaaS multi-agencia
**Método:** lectura directa del código y consultas de solo lectura contra producción. Cada afirmación cita archivo y línea, o el comando que la verifica. Nada inferido.

---

## 0. Qué cambió desde la primera versión

La primera versión de este documento diagnosticó tres bloqueantes críticos para vender a una segunda agencia. Desde entonces se ejecutaron 10 de las 12 tareas de la Fase 0. Esta sección resume el delta; el resto del documento está reescrito para reflejar el estado actual, no el original.

| # | Bloqueante original | Estado ahora |
|---|---|---|
| R1 | 31 de 51 tablas sin esquema versionado | **Resuelto.** Eran en realidad 56 tablas; las 58 migraciones reales se recuperaron desde `supabase_migrations.schema_migrations` en producción. **56 de 56 tablas tienen su `CREATE TABLE` versionado. Cobertura completa, verificada por diff, no por muestreo.** |
| R2 | Multi-tenancy real en la base, falso en la interfaz | **Resuelto.** Contexto de workspace activo persistido, selector conectado a datos reales, con caída segura si la selección guardada ya no es válida. |
| R3 | 5 edge functions solo en producción | **Resuelto — y eran 9, no 5.** Las 16 funciones desplegadas están ahora en el repositorio, incluida toda la firma de contratos y el ciclo de sincronización de Google Calendar, que ni siquiera aparecían en el inventario original porque el frontend nunca las invoca directamente. |
| R4 | Credenciales de Supabase hardcodeadas | **Resuelto**, con un hallazgo de seguridad real en el camino: mover a variables de entorno destapó un bypass de autenticación dormido en los guardias de ruta (ver §6, R2-antiguo). |
| R7 | Marca Astratta incrustada en 12 puntos | **Resuelto, y eran más de 12.** Se encontraron y corrigieron dos correos transaccionales reales (invitación al portal, solicitud de aprobación) que hoy llegan a clientes de cualquier agencia con el pie "Powered by Astratta Agency" — no estaban en el inventario original. |
| R9 | Miembro suspendido conserva permisos | **Resuelto, y era más amplio.** No una función, tres: invitar al portal, invitar al equipo, y disparar solicitudes de aprobación. Los helpers SQL de RLS (`is_workspace_member` y similares) ya filtraban correctamente por `status = 'active'` desde el origen — el agujero estaba solo en el código TypeScript que reimplementaba la comprobación a mano. |

**Lo que se descubrió y no estaba en el diagnóstico original:**

- Un **bug en vivo**: el filtro de ubicación de la lista de Clientes no era solo un desplegable con ciudades de Texas — `"Dallas-Fort Worth, TX"` era el **filtro activo por defecto al cargar la página**. Cualquier workspace con clientes fuera de esa zona vería la lista vacía sin saber por qué.
- Otro **bug en vivo**: `workspaceName` era una prop que existía en toda la cadena de componentes del flujo de aprobación pero nunca se conectaba — el mensaje de respaldo manual siempre firmaba como "Astratta Agency", para cualquier workspace.
- Un **secreto de producción en texto plano** dentro de una de las migraciones recuperadas (el `X-Sync-Secret` compartido entre `pg_cron` y la sincronización de Google Calendar). Se redactó al versionarlo. Sigue activo en producción y debe rotarse — tarea pendiente, ver §8.
- **AWS SES sigue en modo sandbox**, confirmado por el usuario. Los correos de invitación y aprobación no llegan a destinatarios reales hoy. Esto no estaba en el diagnóstico original porque no era visible desde el código — solo se confirma consultando la consola de AWS.

**Lo que sigue abierto de la Fase 0:** sacar SES del sandbox y rotar el secreto de Google Calendar (ambas bloqueadas en acciones que solo el usuario puede ejecutar fuera de este entorno). Y dentro de lo que se dio por "resuelto", dos matices con calado real:

- El esquema está versionado, pero **las políticas RLS de las 40 tablas recién recuperadas siguen sin pruebas ejecutables** — se auditaron a mano contra `pg_policies` (cero políticas permisivas encontradas, ver §6) pero `docs/security-tests.sql` sigue siendo prosa, no código.
- `database.types.ts` ya no es un stub — se regeneró completo desde producción —, pero los **281 `(supabase as any)` siguen ahí**. Los tipos reales ya pueden atrapar esos errores; nadie los ha usado todavía para eso.

---

## 1. Resumen ejecutivo

Astratta OS es un sistema operativo de agencia **en producción y sustancialmente completo**. No es un prototipo: 310 archivos TypeScript, ~51.000 líneas, **56 tablas** y más de 533 commits. Once módulos funcionan con datos reales de punta a punta —clientes, proyectos, tareas, calendario de contenido con aprobaciones, contratos con firma electrónica, facturación con Stripe, CRM con propuestas, reportes de cliente, documentos, equipo y portal de cliente con marca.

La calidad interna es mejor de lo habitual en un proyecto nacido de un generador. **No hay un solo mock, ni un `TODO`, ni un `FIXME` en `src/`.** El diseño de aislamiento de datos —cuando se auditó tabla por tabla— resultó sólido: cero políticas RLS permisivas en las 56 tablas, no solo en las que ya estaban versionadas.

El problema seguía siendo que el producto se construyó como herramienta interna y ahora se vende como SaaS multi-agencia con dominio propio. La Fase 0 atacó exactamente eso. Lo que queda por resolver hoy es más pequeño y más concreto que al principio:

1. **SES en modo sandbox** — los correos transaccionales no llegan a destinatarios reales. Esto bloquea el valor del portal de cliente hoy, no en un roadmap futuro.
2. **Un secreto de producción por rotar** tras haberse encontrado en texto plano al recuperar el historial de migraciones.
3. **281 casts sin tipar** — la infraestructura para eliminarlos ya existe (tipos reales generados); falta el trabajo mecánico de quitarlos módulo por módulo.
4. **Cero pruebas automatizadas** — sigue siendo cierto. La auditoría manual de RLS da confianza puntual, no una red de seguridad continua.
5. **Sin división de código** — las ~38 páginas siguen viajando en un solo paquete de 3,19 MB.

### Las tres decisiones de mayor impacto (siguen vigentes)

**Primera: el orden ya se respetó.** El multi-tenancy real en la interfaz se resolvió antes de tocar Marketing o Auditorías — exactamente la secuencia que este documento recomendaba, y la razón por la que esos dos módulos, cuando se construyan, no heredarán el defecto de raíz.

**Segunda: no escribir un planificador de tareas propio.** Sigue en pie para la Fase 3. Nada de lo hecho en la Fase 0 cambia esta recomendación.

**Tercera: empezar la revisión de la aplicación de Meta ya.** Si no se inició en paralelo a la Fase 0, es el momento de hacerlo — sigue siendo lo único del roadmap cuyo tiempo no depende del ritmo de desarrollo.

---

## 2. Arquitectura

| Capa | Elección |
|---|---|
| Framework | React 18.3 + Vite 5.4 + `@vitejs/plugin-react-swc` |
| Lenguaje | TypeScript 5.8, **con `strict: false`** |
| Rutas | react-router-dom 6.30 |
| Estado de servidor | TanStack Query 5.83 |
| Estado global | Un contexto de aplicación (`ActiveWorkspaceProvider`, nuevo) + caché de React Query + `useState` local |
| Backend | Supabase (proyecto propio, no Lovable Cloud), **credenciales por variable de entorno** |
| UI | shadcn/ui sobre 28 paquetes de Radix + Tailwind 3.4 |
| Editor | TipTap 3.27 · Gráficas: Recharts · Arrastre: `@dnd-kit` · PDF: jsPDF |
| Despliegue | Vercel (SPA, una sola reescritura en `vercel.json`) |
| Correo | Amazon SES v2, firma SigV4 escrita a mano — **cuenta en modo sandbox** |

**Origen:** scaffold de Lovable.dev (`lovable-tagger` en devDependencies, directorio `.lovable/`). El `README.md` sigue siendo el boilerplate original.

### Cómo fluyen los datos

No hay carpeta `api/` ni `services/`. **Toda la capa de datos vive en `src/hooks/`**, cada uno envolviendo llamadas directas a Supabase en React Query. El patrón es consistente: tipo de fila escrito a mano, `useQuery` con clave `[entidad, workspaceId, filtros]`, `enabled: !!workspaceId`, y mutaciones que invalidan la caché.

**Novedad:** `src/hooks/useActiveWorkspace.tsx` dejó de ser un hook plano — ahora es un contexto (`ActiveWorkspaceProvider`, montado en `AppShell`) que persiste la selección de workspace en `localStorage` y expone la lista completa de workspaces del usuario, no solo el primero. Los 21 consumidores existentes no cambiaron ni una línea: se preservó exactamente la forma `{ workspace, isLoading }` que ya esperaban.

**Mucha lógica de negocio real vive en Postgres**, no en TypeScript: triggers que rellenan la línea de tiempo del cliente, numeración automática de facturas, recálculo de totales, aplicación de pagos, fan-out de notificaciones, `apply_project_template()`, guardias contra doble envío en aprobaciones. Esto ahora es completamente auditable — las 58 migraciones que contienen esta lógica están versionadas (§4).

### Rutas

39 rutas en un único `src/App.tsx`, **todas importadas de forma síncrona**. Sigue sin haber `React.lazy` en ninguna parte — las páginas siguen viajando en el paquete inicial. El build actual pesa **3,19 MB** (916 KB comprimido), sin cambios desde el diagnóstico original porque no se atacó R8 en esta ronda.

- **7 públicas** — login, registro, recuperación, captura de leads, vista pública de propuestas y contratos
- **17 de workspace** bajo `/app`, protegidas por `RequireAgencyAuth` → `AppShell`
- **14 de portal** bajo `/portal`, protegidas por `RequireClientAuth` → `PortalShell`
- 1 de onboarding, 1 comodín

---

## 3. Inventario de módulos

Sin cambios de fondo respecto al diagnóstico original — la Fase 0 fue infraestructura y saneamiento, no funcionalidad nueva. Dos actualizaciones puntuales:

| Módulo | Estado | Cambios de esta ronda |
|---|---|---|
| **Ventas / CRM** | Completo | El PDF de diagnóstico (`diagnostic-checklist.tsx`) ahora usa el nombre y los colores reales del workspace en vez de "Astratta Agency" hardcodeado |
| **Clientes** | Completo | El filtro de ubicación pasó de desplegable fijo (Texas) a búsqueda de texto libre; ya no aplica un filtro invisible por defecto |

El resto del inventario —Tareas, Contratos, Calendario, Aprobaciones, Finanzas, Proyectos, Reportes, Documentos, Portal, Almacenamiento, Notificaciones, Equipo, Configuración, Auditorías, Recibos, Marketing— se mantiene exactamente como se describió originalmente. Ver el documento previo o el código directamente para el detalle módulo por módulo.

**Cambio en "lo declaradamente incompleto":** `src/components/require-auth.tsx` (código muerto, guardia obsoleto) se eliminó — no parcheado, borrado, porque compartía el mismo patrón de bypass inseguro que se corrigió en los guardias reales (§6) y no tenía ningún importador.

---

## 4. Modelo de datos

**56 tablas en producción. 56 con esquema versionado en el repositorio. 0 sin versionar.**

Verificado por diff exacto, no por conteo aproximado:

```bash
# Tablas reales en producción (information_schema.tables)
# vs. tablas con CREATE TABLE en docs/migrations/ + supabase/migrations/
comm -23 tablas_produccion.txt tablas_en_migraciones.txt
# → vacío
```

### De dónde viene cada tabla

- **16 tablas** ya estaban versionadas antes de esta ronda, en `docs/migrations/001-016` (ahora marcado como histórico, ver más abajo).
- **40 tablas** se recuperaron en esta ronda desde `supabase_migrations.schema_migrations` en producción — la tabla de control real que usa la CLI de Supabase, que conservaba las **58 migraciones completas** con su SQL original, incluso aunque el repositorio solo tuviera 2 archivos locales antes de empezar.

Esto cambia la naturaleza del riesgo original: no era que el esquema estuviera *perdido*, estaba *fuera del repositorio*. Ambas cosas impiden auditar y reproducir, pero solo la primera es irrecuperable. Resultó ser la segunda.

### `docs/migrations/` — ahora histórico, no ejecutar

El directorio original (`001` a `016`) se marcó obsoleto con un `README.md` explícito. Motivo concreto: `001_astratta_core_schema.sql` define `tasks` sin nueve columnas que la tabla real lleva desde julio (`lead_id`, `parent_task_id`, `type`, `tags`, `estimated_hours`, `timer_started_at`, `timer_started_by`, `contract_id`, `content_subtask_key`). El historial real y ejecutable vive únicamente en `supabase/migrations/` — 58 archivos, con la versión y el nombre originales de producción.

### Dos migraciones no reproducibles tal cual

Al recuperar el historial aparecieron dos migraciones de datos semilla con el UUID del workspace de Astratta incrustado — fallarían por clave foránea en un entorno nuevo:

- `20260701193458_project_templates_seed_defaults.sql`
- `20260701195622_contracts_seed_clauses_and_templates.sql` (esta además tiene una atadura legal: las cláusulas se rigen por las leyes de Texas)

Ambas llevan nota explicando por qué, y qué hacer en la Fase 1 (sembrar plantillas desde el trigger de creación de workspace, con jurisdicción como parámetro).

### Un secreto encontrado y redactado

`20260702164057_google_calendar_sync_secret_vault.sql` contenía el valor literal del secreto compartido entre `pg_cron` y la edge function de sincronización de Google Calendar. Se redactó al versionar —escribirlo lo habría dejado en el historial de git para siempre— y el archivo explica cómo regenerarlo. **El secreto usado en producción sigue siendo el original y debe rotarse** (tarea pendiente, §8).

### Aislamiento de datos: auditado en las 56, no solo en las 16 originales

La migración `001_astratta_core_schema.sql` (histórica pero con lógica todavía vigente) define nueve funciones auxiliares `SECURITY DEFINER`: `is_workspace_member`, `has_workspace_role`, `is_workspace_owner`, `can_write_workspace`, `is_client_user`, `is_client_admin`, `client_in_member_workspace`, `shares_workspace_with`, `profile_visible_to_client_user`. Todas filtran por `status = 'active'` desde el origen.

**Auditoría ejecutada esta ronda contra producción, no contra el código:**

```sql
select count(*) from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
-- → 0 (las 56 tablas tienen RLS activo)
```

```sql
-- Barrido de las ~140 políticas de las 56 tablas buscando USING(true)
-- o cualquier condición que no referencie workspace/client/auth.uid()
-- → 0 políticas permisivas encontradas
```

Las únicas 3 políticas que no encajaron en el patrón automático de búsqueda (`invoice_items_*`) se revisaron a mano: usan `invoice_can_write()`, que también está scopeado por workspace. Dos tablas (`google_calendar_connections`, `google_calendar_sync_map`) tienen RLS activo sin ninguna política — es decir, deniegan todo salvo `service_role`, que es el diseño correcto para tablas que solo tocan las edge functions.

**Lo que esta auditoría no es:** pruebas ejecutables. `docs/security-tests.sql` sigue siendo prosa. Convertirlo en un test real que corra en CI es el trabajo que falta para que este resultado no dependa de repetir la consulta a mano cada vez.

### Rastros de un solo inquilino en el esquema (sin cambios — son datos históricos, no código)

- `clients.location` por defecto `'Dallas-Fort Worth, TX'` — el dato en la base sigue así; lo que cambió es que la aplicación ya no lo fuerza como filtro activo (§3).
- Colores por defecto de los workspaces: `#5140f2` / `#ff7503` — se mantienen como defaults neutros de plataforma, no como marca de agencia (ver criterio en §6, R7).
- `media_assets` conserva columnas específicas de clínicas estéticas (`consent_required`, `patient_ref`, `treatment`…) heredadas de un cliente concreto.

---

## 5. Lógica de servidor

### Edge functions

**16 funciones desplegadas. 16 en el repositorio. 0 ausentes.**

El inventario original decía "11 invocadas desde el frontend, 6 en el repo, 5 ausentes" — subestimaba el problema. Había **9 funciones reales sin versionar**, no 5: cuatro no aparecían en el análisis porque el frontend nunca las invoca directamente (se activan por webhook de Stripe, por el propio flujo de OAuth de Google redirigiendo a ellas, o por `pg_cron`).

| Función | Cómo se descubrió | Qué hace |
|---|---|---|
| `stripe-webhook` | No la invoca el frontend — la invoca Stripe | Registra todos los pagos entrantes. Sin ella, `payments` nunca se llena: es la mitad del módulo de Finanzas |
| `google-calendar-oauth-callback` | Redirect target de Google, no un `fetch` del frontend | Cierra el intercambio OAuth, crea/reutiliza el calendario secundario |
| `google-calendar-sync-cycle` | Invocada por `pg_cron` cada 5 minutos | Sincronización bidireccional de tareas y posts con Google Calendar |
| `subscribe-newsletter` | Consumida por un blog fuera de este repositorio | Captura de suscriptores; comentario en el código confirma que SES sigue en sandbox |

Las otras 12 ya estaban documentadas en la primera versión de este análisis.

### `supabase/config.toml` reescrito

El archivo original listaba 5 funciones. Ahora lista las 16, explícitamente, con comentarios explicando por qué cada `verify_jwt = false` es seguro (autovalidación en el cuerpo de la función, firma de terceros como Stripe, o secreto compartido con `pg_cron`). Se encontró y corrigió una deriva real: `send-team-invite` estaba desplegada con `verify_jwt = false` pero no figuraba en el config — un redespliegue desde el repositorio la habría puesto en `true` por defecto, rompiendo las invitaciones de equipo en producción sin ningún cambio de código visible.

### Dos bugs de dominio corregidos en las funciones recuperadas

`google-calendar-oauth-callback` y `google-calendar-sync-cycle` tenían `https://astratta-os.lovable.app` hardcodeado — el dominio muerto de Lovable. Tras conectar Google Calendar, el usuario aterrizaba en un dominio obsoleto, y cada evento sincronizado llevaba un enlace roto en su descripción. Corregido con el mismo patrón que ya usaba `send-content-approval-request` (`SITE_URL` con reserva a `PROD_ORIGIN`, y una guarda explícita contra cualquier valor que contenga "lovable").

### El hallazgo de seguridad más importante de esta ronda

No estaba en ninguna lista de riesgos original porque **no existía como riesgo hasta que se tocó el código de configuración.** `RequireAgencyAuth.tsx` y `RequireClientAuth.tsx` tenían:

```tsx
if (!configured) return <>{children}</>;
```

Con las credenciales de Supabase hardcodeadas, `configured` era siempre `true` — esta rama nunca se ejecutaba en producción. Era código dormido, indistinguible de código muerto por inspección estática. Al mover la configuración a variables de entorno (§6, R4), esta rama se volvía viva: **si Vercel no tuviera las variables configuradas, cualquier persona habría visto la aplicación entera —clientes, contratos, credenciales— sin sesión.**

Se corrigió antes de que existiera ventana de exposición, restringiendo el bypass a `import.meta.env.DEV` (nunca en un build desplegado). Se verificó el camino completo: sin configuración, `useAuth` deja `session = null` y las consultas de `useUserContext` quedan deshabilitadas sin colgarse — ambos guardias caen limpiamente a su pantalla de login, no a una pantalla en blanco ni a un acceso abierto.

**La lección:** un atajo de desarrollo (`!configured`) que es inofensivo mientras la configuración está hardcodeada se vuelve una vulnerabilidad real en el momento exacto en que esa configuración se externaliza. Vale la pena revisar el resto del código en busca del mismo patrón antes de la Fase 1.

### RPCs y triggers

Ocho RPCs se llaman desde el cliente. Con las 58 migraciones recuperadas, **los ocho tienen su cuerpo versionado** — antes solo dos lo tenían.

Las credenciales de cliente siguen bien resueltas: cifrado del lado del servidor vía Supabase Vault, cada revelación registrada en `client_credential_access_log`. Confirmado al leer la migración original completa (`client_credentials_vault`): usa `vault.create_secret()` / `vault.decrypted_secrets` correctamente, no una implementación casera.

---

## 6. Riesgos, por severidad — estado actualizado

### Resueltos esta ronda

| # | Riesgo original | Cómo se resolvió |
|---|---|---|
| R1 | 31 tablas sin esquema versionado | 58 migraciones recuperadas de `schema_migrations`. 56/56 tablas cubiertas, verificado por diff |
| R2 | Multi-tenancy falso en la interfaz | `ActiveWorkspaceProvider` con persistencia en `localStorage` y caída segura |
| R3 | 5 edge functions solo en producción | Eran 9. Las 16 desplegadas están en el repo |
| R4 | Credenciales de Supabase hardcodeadas | Variables de entorno + `.env.example`. Bypass de seguridad dormido encontrado y corregido en el proceso (ver §5) |
| R7 | Marca Astratta en 12 puntos | Eran más de 12, incluidos dos correos transaccionales reales. Todos corregidos con el criterio: identidad de plataforma (`Astratta OS`) se conserva donde es honesta; identidad de agencia específica se quita o se sustituye por datos reales del workspace donde hay contexto disponible sin romper RLS |
| R9 | Miembro suspendido con permisos | Eran 3 funciones, no 1. Los helpers SQL ya filtraban correctamente — el agujero era solo en TypeScript |

### Parcialmente resuelto

**R5. Sin seguridad de tipos en la capa de datos.**
`database.types.ts` ya no es un stub — se regeneró completo desde producción (3.787 líneas, 56 tablas, 57 funciones, 20 enums). Los alias con nombre que usaban 17 archivos se movieron a `enums.ts`, derivados de `Database`, precisamente para que el archivo pueda regenerarse sin romper nada — verificado regenerando y confirmando que los 17 imports siguen resolviendo.
**Lo que no cambió:** los 281 `(supabase as any)` siguen ahí. Los tipos reales ya pueden atraparlos — nadie los ha usado todavía para eso. Concentración: `useContracts.ts` (28), `useTasks.ts` (27), `useTeam.ts` (16), `useInvoices.ts` (15).

### Sin cambios — siguen abiertos

**R6. Cero pruebas automatizadas.** La auditoría de RLS de esta ronda (§4) da confianza puntual sobre el estado *actual* del aislamiento, pero es una fotografía, no una red de seguridad: nada impide que una migración futura reintroduzca una política permisiva sin que nadie lo note. `docs/security-tests.sql` sigue siendo prosa.

**R8. Sin división de código.** Sin cambios — 3,19 MB en un solo paquete, sin `React.lazy`.

### Nuevos, descubiertos esta ronda

**R10. AWS SES en modo sandbox — confirmado en producción.**
Los correos de `send-portal-invite`, `send-team-invite` y `send-content-approval-request` no llegan a destinatarios reales hoy. El respaldo de "copiar enlace manualmente" no es una comodidad — es la única vía que funciona actualmente para invitar a un cliente o notificar una aprobación.
*Impacto:* bloquea el valor real del portal de cliente ahora mismo, no en un roadmap futuro.
*Coste de arreglo:* fuera del alcance de este entorno — requiere solicitar acceso de producción a AWS (formulario, 24–48h), verificar dominio con DKIM, y configurar gestión de rebotes/quejas vía SNS antes de cualquier envío masivo.

**R11. Secreto de producción encontrado en texto plano, ya redactado, pendiente de rotar.**
Ver §4. El secreto de sincronización de Google Calendar viajaba en claro en la migración `20260702164057`. Se redactó al versionar; el valor en uso en producción no cambió.
*Coste de arreglo:* bajo — `vault.update_secret()` con un valor nuevo, actualizar el cron job y el secreto de la edge function. Requiere acceso de escritura a producción, que no se ejecutó en esta ronda por ser una acción consecuente que merece confirmación explícita.

---

## 7. Brechas frente a la visión

Sin cambios respecto al diagnóstico original — la Fase 0 fue saneamiento, no construcción de Marketing ni Auditorías. La tabla comparativa contra GoHighLevel y Zoho, y la lectura de dónde gana y dónde pierde Astratta OS, se mantienen intactas. Ver la sección homónima del documento original o el código directamente.

---

## 8. Roadmap — estado de la Fase 0

Ejecución asumida: una persona a tiempo completo con Claude.

### Fase 0 — Bloqueantes de SaaS

| # | Tarea | Estado |
|---|---|---|
| 1 | Recuperar el esquema completo | ✅ Hecho — 58 migraciones, 56/56 tablas |
| 2 | Recuperar las edge functions | ✅ Hecho — eran 9, no 5; las 16 están versionadas |
| 3a | Auditar el aislamiento tabla por tabla | ✅ Hecho — 0 políticas permisivas en 56 tablas |
| 3b | Convertir `security-tests.sql` en pruebas ejecutables | ⬜ Pendiente |
| 4a | Generar tipos reales | ✅ Hecho |
| 4b | Eliminar los 281 `as any` | ⬜ Pendiente — infraestructura lista, falta el trabajo módulo por módulo |
| 5 | Separar entornos (variables de entorno) | ✅ Hecho — con hallazgo y corrección de un bypass de seguridad dormido |
| 6 | Multi-tenancy real en la interfaz | ✅ Hecho |
| 7 | Desincrustar la marca | ✅ Hecho — alcance mayor al estimado, incluidos 2 correos transaccionales reales |
| — | Corregir filtro de miembro suspendido | ✅ Hecho — eran 3 funciones, no 1 |
| — | Corregir dominio muerto de Lovable | ✅ Hecho — 2 funciones adicionales encontradas con el mismo bug |
| 8 | **Sacar AWS SES del sandbox** | ⬜ Pendiente — requiere acción del usuario en AWS |
| 9 | **Rotar el secreto de Google Calendar** | ⬜ Pendiente — requiere confirmación explícita para escribir en producción |

**En paralelo, si no se inició ya: la revisión de la aplicación de Meta.** Sigue siendo lo único del roadmap cuyo tiempo no depende del ritmo de desarrollo.

### Fases 1 a 4

Sin cambios respecto al roadmap original. Cimientos comerciales (dominio propio, suscripciones, alta autoservicio), Auditorías automáticas, Motor de automatización, Cierre de huecos funcionales. Ver el documento original para el detalle — ninguna decisión de esas fases se tomó ni se revisó en esta ronda.

---

## 9. Apéndice: archivos de referencia (actualizado)

**Rutas y navegación** — `src/App.tsx` · `src/components/app-sidebar.tsx` · `src/components/portal/portal-sidebar.tsx`

**Inquilinos y acceso** — `src/hooks/useUserContext.ts` · `src/hooks/useActiveWorkspace.tsx` (nuevo: contexto, no hook plano) · `src/components/workspace-switcher.tsx` (reescrito con datos reales) · `src/components/auth/RequireAgencyAuth.tsx` · `src/components/auth/RequireClientAuth.tsx` · `src/hooks/portal/useClientPortalContext.ts`

**Configuración** — `src/integrations/supabase/client.ts` (variables de entorno) · `src/integrations/supabase/database.types.ts` (regenerado, real) · `src/integrations/supabase/enums.ts` (nuevo: alias derivados) · `.env.example` (nuevo) · `supabase/config.toml` (reescrito, 16 funciones explícitas) · `vercel.json`

**Esquema** — `supabase/migrations/` (58 archivos, fuente de verdad real) · `docs/migrations/README.md` (nuevo: marca el directorio viejo como histórico) · `docs/security-tests.sql` (sigue siendo prosa, no ejecutable)

**Servidor** — `supabase/functions/` (16 funciones, todas versionadas) · `supabase/functions/_shared/auth.ts` · `supabase/functions/_shared/ses.ts`

**Hooks de mayor peso (y mayor concentración de `as any`)** — `useContracts.ts` (726 líneas, 28 casts) · `useTasks.ts` (664 líneas, 27 casts) · `useTeam.ts` (16 casts) · `useInvoices.ts` (15 casts) · `useClientReports.ts` (895 líneas, el más grande)

---

## Verificación de las cifras de este documento

```bash
# Tablas en producción
select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';
# → 56

# Cobertura de esquema (debe devolver vacío)
comm -23 <(tablas de producción, una por línea, ordenadas) \
         <(grep -rhoiE "create table( if not exists)? (public\.)?[a-z_]+" docs/migrations/*.sql supabase/migrations/*.sql \
           | sed -E 's/.*[[:space:]]//; s/^public\.//' | sort -u)

# Edge functions locales
ls supabase/functions | grep -v _shared | wc -l
# → 16

# Migraciones locales
ls supabase/migrations/*.sql | wc -l
# → 58

# Casts sin tipar restantes
grep -rc "supabase as any" src --include="*.ts" --include="*.tsx" | awk -F: '{sum+=$2} END {print sum}'
# → 281

# Políticas RLS permisivas (debe devolver 0 filas)
select tablename, policyname from pg_policies where schemaname='public'
  and coalesce(qual,'') !~ 'workspace|client|auth\.uid|user_id|recipient|profile'
  and coalesce(with_check,'') !~ 'workspace|client|auth\.uid|user_id|recipient|profile';
```

*Documento actualizado tras ejecutar 10 de las 12 tareas de la Fase 0. Ningún cambio de esta ronda se comiteó a git — todo queda pendiente de revisión antes de integrarse.*
