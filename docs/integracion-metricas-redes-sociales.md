# Integración de métricas de redes sociales (Instagram, Facebook, TikTok)

Investigación · 30 oct 2026 · Objetivo: dashboard por cliente + reporte mensual automático, conectando cada plataforma directo a Astratta OS (sin Supermetrics, Windsor, Phyllo ni similares).

---

## 1. Resumen

- **Ya existe la base.** `social_connections` (migración `20260703004036`) guarda la cuenta por cliente, sus scopes y los tokens como punteros a `vault.secrets`. `client_reports` ya tiene `hero_stats`, `platform_kpis`, `top_posts` y `audience` en jsonb. Lo que falta: OAuth por plataforma, un job de sincronización y tablas de métricas históricas.
- **La regla de diseño más importante: guardar snapshots diarios propios.** Las APIs no dan historial completo. Instagram solo devuelve `follower_count` de los últimos 30 días, las historias desaparecen a las 24 h, TikTok Display API solo da contadores acumulados y Meta elimina métricas cada pocos meses. El reporte mensual tiene que calcularse con datos guardados en nuestra base, no con una consulta en vivo el día 1.
- **Meta: un solo login (Facebook Login for Business) cubre Facebook e Instagram.** Instagram Login queda como alternativa para clientes con IG profesional y sin Página de Facebook.
- **TikTok tiene dos niveles.** El Display API (fácil de aprobar) da seguidores, likes y vistas por video. El API for Business (cuentas Business) agrega alcance, visitas al perfil, tiempo de reproducción y demografía, pero la aprobación es más exigente.
- **Lo que más tarda son los trámites, no el código.** La verificación del negocio y el App Review de Meta, y la auditoría de TikTok, toman semanas. Hay que iniciarlos ya (la radiografía ya lo recomendaba).

---

## 2. Meta (Instagram + Facebook)

### 2.1 Dos formas de conectar

| | **A. Facebook Login for Business** (recomendada) | **B. Instagram API con Instagram Login** |
|---|---|---|
| Qué cubre | Página de FB + cuenta IG profesional vinculada | Solo IG profesional (no necesita Página) |
| Token | User token de larga duración, 60 días → **Page token sin vencimiento** | Token de larga duración, 60 días, se renueva con `refresh_access_token` |
| Insights de historias por webhook | Sí | No (los webhooks de insights no están soportados) |
| Métricas nuevas (p. ej. `link_clicks` de historias, jun 2026) | Suelen llegar aquí primero | A veces llegan después |
| Cuándo usarla | Por defecto | Cliente sin Página de FB o que no quiere vincularla |

### 2.2 Permisos

**Ruta A: Facebook Login for Business**

| Permiso | Para qué |
|---|---|
| `pages_show_list` | Listar las Páginas que el usuario administra |
| `pages_read_engagement` | Datos de la Página, posts, seguidores y obtener el Page token |
| `read_insights` | Insights de Página y de posts |
| `instagram_basic` | Perfil IG, lista de media |
| `instagram_manage_insights` | Insights de cuenta y de media de IG |
| `business_management` | Leer activos dentro de portafolios comerciales (necesario cuando la Página o el IG pertenecen al Business Manager del cliente) |
| `pages_read_user_content` *(opcional)* | Comentarios y contenido de usuarios en la Página, si se quiere analizar sentimiento |

**Ruta B: Instagram Login**

| Permiso | Para qué |
|---|---|
| `instagram_business_basic` | Perfil y media |
| `instagram_business_manage_insights` | Insights de cuenta y de media |

No pedir permisos de publicación (`instagram_content_publish`, `pages_manage_posts`) en esta fase. Cada permiso extra alarga el App Review y asusta al cliente en la pantalla de consentimiento. Si después se publica desde la app, va en otra solicitud de revisión.

### 2.3 Standard Access vs. Advanced Access (afecta los plazos)

- **Standard Access** (por defecto, sin revisión): funciona con personas que tienen un rol en la app o en el portafolio comercial que es dueño de la app, y con los activos a los que esas personas tienen acceso.
- **Advanced Access** (App Review + Business Verification): necesario para que cualquier persona externa, como el dueño de la cuenta del cliente, autorice la app.

En la práctica hay dos escenarios:

1. **Solo los clientes de Astratta (uso propio, inmediato).** Cada cliente agrega el portafolio de Astratta como **socio** de su Página e Instagram en Meta Business Suite (Configuración → Socios). Un **System User** del portafolio de Astratta, asignado a esos activos, genera tokens que no vencen. Con eso la app funciona en Standard Access sin esperar la revisión. **Verificarlo con un cliente real antes de comprometerse**: la documentación de Meta es ambigua sobre activos de terceros compartidos por socio.
2. **Astratta OS como SaaS para otras agencias.** Cada agencia conecta las cuentas de sus clientes con su propio login, y eso exige Advanced Access en todos los permisos de 2.2. No hay atajo.

Recomendación: arrancar con el escenario 1 para tener datos reales ya, y en paralelo enviar el App Review para el escenario 2.

### 2.4 Qué métricas pedir (vigentes a oct 2026)

Meta reemplazó *impressions* por **views** en IG (abril 2025) y en Páginas (desde nov 2025). La v25 anunció la eliminación de 15 métricas más de Página al salir la v26, y la v26 ya es la versión más reciente (confirmado el 1 nov 2026), así que esas métricas deben darse por eliminadas en todas las versiones. **No hay que dejar los nombres de métricas fijos en el código**: deben vivir en un catálogo (§4) para poder cambiarlos sin redeploy.

**Instagram: cuenta** (`/{ig-user-id}/insights`)

| Métrica | Notas |
|---|---|
| `views` | Reemplaza impressions. Breakdowns: `follow_type`, `media_product_type` |
| `reach` | Cuentas únicas alcanzadas |
| `accounts_engaged`, `total_interactions` | Engagement agregado |
| `likes`, `comments`, `shares`, `saves`, `replies`, `reposts` | `reposts` existe desde dic 2025 |
| `follows_and_unfollows` | Altas y bajas de seguidores |
| `profile_links_taps` | Clics en links del perfil |
| `follower_count` | Diario, **solo los últimos 30 días**. Hay que guardarlo cada día |
| `follower_demographics`, `engaged_audience_demographics` | Edad, género, ciudad, país. Solo el top 45, y exige 100+ seguidores |

**Instagram: por publicación** (`/{ig-media-id}/insights`)

- Feed y carrusel: `views`, `reach`, `likes`, `comments`, `shares`, `saved`, `total_interactions`, `profile_visits`, `follows`
- Reels: además `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, `reels_skip_rate` (dic 2025), `crossposted_views` y `facebook_views`
- Historias: `views`, `reach`, `replies`, `navigation`, `shares`, `link_clicks` (jun 2026, solo con Facebook Login). **Solo disponibles 24 h**, así que hay que leerlas varias veces al día o usar el webhook `story_insights`.
- Los insights por publicación se guardan hasta 2 años.

**Facebook: Página** (`/{page-id}/insights`)

| Métrica | Notas |
|---|---|
| `page_media_view` | Reemplaza `page_impressions`. Desglose pagado/orgánico |
| `page_total_media_view_unique` | Reemplaza `page_impressions_unique` (alcance) |
| `page_post_engagements` | Interacciones |
| `page_follows`, `page_daily_follows_unique`, `page_daily_unfollows_unique` | Seguidores |
| `page_views_total` | Visitas a la Página |
| Posts: `post_media_view`, `post_total_media_view_unique`, `post_clicks`, `post_reactions_by_type_total` | Por publicación |

> Antes de implementar, correr cada métrica contra una cuenta real con la versión fijada (v26.0). Meta devuelve error, no cero, si la métrica ya no existe. Y si el dato no está disponible, devuelve un arreglo vacío. Las dos respuestas deben quedar registradas en `last_error` sin tumbar la sincronización.

### 2.5 Configuración de la app de Meta

**Estado de la app "Astratta OS" (`973050372445258`) al 1 nov 2026:** recién creada y sin configurar. Está en modo desarrollo, sin portafolio comercial, sin verificación, sin política de privacidad, términos, URL de borrado de datos, dominios ni URLs de redirección, sin permisos aprobados y sin envíos a App Review. Tampoco tiene violaciones ni webhooks. Ningún punto de esta lista está completo todavía.

**URLs para el panel de Meta**, una vez desplegado:
- Política de privacidad: `https://app.astrattaagency.com/privacidad`
- Data Deletion Request URL: `https://vdnblnrwkkychxzbixam.supabase.co/functions/v1/meta-data-deletion`

Las funciones de OAuth deben guardar en `social_connections.external_user_id` el `user_id` de quien autoriza. Sin ese dato, el callback no puede encontrar qué conexiones borrar.

- [ ] App de tipo **Business** en developers.facebook.com, vinculada al portafolio comercial de Astratta.
- [ ] **Business Verification** del portafolio (documentos legales de la empresa). Requisito para Advanced Access.
- [ ] Productos/casos de uso: *Facebook Login for Business* (con una **Configuration ID** que pida los permisos de 2.2) e *Instagram API*.
- [ ] **Valid OAuth Redirect URIs**: la URL de la edge function `meta-oauth-callback`.
- [ ] **App Domains**, **Privacy Policy URL**, **Terms of Service URL**, ícono y categoría.
- [ ] **Data Deletion Callback URL** (obligatorio): una edge function que borre las conexiones y métricas del usuario cuando Meta la llame.
- [ ] Modo **Live**.
- [ ] Fijar la **versión del Graph API** en una sola constante (p. ej. `META_GRAPH_VERSION=v26.0`) y revisar el changelog en cada versión nueva (aprox. cada 4 meses; cada versión dura unos 2 años).
- [ ] Enviar `appsecret_proof` en todas las llamadas server-side.
- [ ] App Review: por cada permiso, un video de la pantalla de conexión y del dashboard donde se usa el dato, más una descripción del caso de uso ("agencia reporta métricas a su propio cliente").
- [ ] Si se usan webhooks: desde el 31 mar 2026 Meta firma con una CA nueva (mTLS). Validar `X-Hub-Signature-256`.
- [ ] Rate limits: Business Use Case limits por Página/cuenta IG (cabeceras `X-Business-Use-Case-Usage`). Leerlas y frenar la sincronización al acercarse al 80 %.

---

## 3. TikTok

### 3.1 Dos productos distintos

| | **Display API** (developers.tiktok.com, Login Kit) | **API for Business: Accounts/Organic** (business-api.tiktok.com) |
|---|---|---|
| Cuentas | Cualquier cuenta (personal, creator, business) | Solo cuentas **Business** |
| Datos de perfil | Seguidores, siguiendo, likes totales, nº de videos | Lo anterior + **visitas al perfil, alcance, seguidores nuevos por día** |
| Por video | `view_count`, `like_count`, `comment_count`, `share_count`, `duration`, `create_time`, portada, link | Lo anterior + **alcance, tiempo de reproducción total/promedio, % visto completo, fuentes de tráfico** |
| Audiencia | No | **Género, país/ciudad, horas de actividad** |
| Historial | Solo contadores acumulados actuales | Rango de fechas limitado (unos 60 días según conectores; confirmar en el portal) |
| Aprobación | Auditoría de la app (sandbox mientras tanto) | Solicitud de desarrollador + revisión del caso de uso |

**Scopes del Display API** (confirmados en la documentación oficial):

| Scope | Para qué |
|---|---|
| `user.info.basic` | open_id, avatar, nombre visible |
| `user.info.profile` | bio, links, verificado |
| `user.info.stats` | `follower_count`, `following_count`, `likes_count`, `video_count` |
| `video.list` | Videos públicos y sus contadores |

**Scopes del API for Business**: los conectores usan `user.info.basic`, `user.info.stats`, `user.insights`, `video.list`, `video.insights` y `comment.list`. **No pude confirmar estos nombres en la documentación pública**, porque el portal se carga con JavaScript y requiere sesión. Hay que validarlos al crear la app en business-api.tiktok.com.

### 3.2 Recomendación para TikTok

1. **Empezar con Display API.** Con un snapshot diario de los contadores se calculan en la base: seguidores ganados en el mes, vistas del mes (diferencia por video), engagement rate y top videos. Eso cubre la mayor parte de un reporte mensual.
2. **Solicitar en paralelo el API for Business** para sumar alcance, retención y demografía cuando lo aprueben. La tabla de conexiones ya soporta las dos rutas con `platform = 'tiktok'` y `granted_scopes`.

### 3.3 Configuración de la app de TikTok

- [ ] Cuenta de desarrollador y app en developers.tiktok.com con **Login Kit** + **Display API**.
- [ ] **Redirect URI** HTTPS registrada (edge function `tiktok-oauth-callback`), coincidencia exacta.
- [ ] Verificación de dominio o URL prefix, si el portal lo pide para la web.
- [ ] Privacy Policy y ToS públicos, ícono, descripción y **video demo** del flujo para la auditoría.
- [ ] **Sandbox** con las cuentas de prueba (máx. ~10 usuarios objetivo) mientras se audita.
- [ ] Parámetro `state` firmado con HMAC (igual que en Google Calendar) para evitar CSRF.
- [ ] **Tokens:** el access token dura **24 h** y el refresh token **365 días**. TikTok puede devolver un refresh token nuevo en cada renovación, así que hay que **guardar siempre el último** en Vault.
- [ ] Manejar la revocación (error `access_token_invalid` o falta de scope): marcar la conexión como `revoked` y avisar al equipo.
- [ ] Las URLs de portada caducan en ~6 h: copiar la miniatura del top post a Storage si se va a mostrar en el reporte PDF.

---

## 4. Arquitectura propuesta en Astratta OS

### 4.1 Flujo

```
Cliente / equipo  ──►  "Conectar Instagram/Facebook/TikTok" (ficha del cliente)
        │
        ▼
edge fn  {meta|tiktok}-oauth-start  ── URL con state HMAC (workspace_id, client_id, user_id)
        │
        ▼
Plataforma (consentimiento)  ──►  edge fn {meta|tiktok}-oauth-callback
        │   · intercambia code → token
        │   · Meta: long-lived user token → lista Páginas/IG → Page token
        │   · guarda token en Vault, fila en social_connections
        ▼
pg_cron (diario 06:00 + cada 4–6 h para historias)
        │  pg_net → edge fn social-sync-cycle (X-Sync-Secret)
        ▼
social-sync-cycle
        │  · por conexión: refresca token si vence < 7 días (TikTok: siempre)
        │  · baja métricas de cuenta del día anterior
        │  · baja posts nuevos + re-lee métricas de posts de los últimos 30 días
        │  · snapshot de audiencia 1 vez por semana
        ▼
social_account_metrics_daily / social_post_metrics / social_audience_snapshots
        │
        ├──► Dashboard del cliente (app + portal)  — consultas agregadas por rango
        └──► "Generar borrador del reporte"  — llena client_reports.{hero_stats,
              platform_kpis, top_posts, audience} para el mes; el equipo edita
              learnings / next_month_plan y publica (flujo actual intacto)
```

Se reutilizan patrones que ya hay en el repo: el OAuth start/callback con `state` firmado y el `*-sync-cycle` protegido por `X-Sync-Secret` (Google Calendar), Vault para secretos (`client_credentials`) y `is_workspace_member` / `is_client_user` para RLS.

### 4.2 Tablas nuevas (borrador)

Cada una con RLS, políticas **y grants explícitos** en la misma migración (regla del 30 oct 2026 en `CLAUDE.md`).

```sql
-- Valores por día de cada métrica de cuenta
create table public.social_account_metrics_daily (
  connection_id uuid not null references public.social_connections(id) on delete cascade,
  workspace_id  uuid not null,
  client_id     uuid not null,
  metric_date   date not null,
  metric        text not null,          -- clave canónica: 'views','reach','followers','engagements'...
  value         numeric not null,
  breakdown     jsonb not null default '{}'::jsonb,  -- p.ej. {"follow_type":"FOLLOWER"}; '{}' = total
  source_metric text not null,          -- nombre real en la API ('page_media_view'), útil cuando Meta renombra
  fetched_at    timestamptz not null default now(),
  primary key (connection_id, metric_date, metric, breakdown)
);

-- Una fila por publicación, con la última lectura de métricas
create table public.social_post_metrics (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.social_connections(id) on delete cascade,
  workspace_id uuid not null, client_id uuid not null,
  external_post_id text not null,
  post_type text,                       -- feed | carousel | reel | story | video
  published_at timestamptz,
  permalink text, caption text, thumbnail_path text,
  metrics jsonb not null default '{}',  -- {views, reach, likes, comments, shares, saves, watch_time...}
  social_post_id uuid references public.social_posts(id) on delete set null,  -- enlace al calendario de contenido
  last_fetched_at timestamptz,
  unique (connection_id, external_post_id)
);

-- Demografía y audiencia (semanal)
create table public.social_audience_snapshots (
  connection_id uuid not null references public.social_connections(id) on delete cascade,
  workspace_id uuid not null, client_id uuid not null,
  captured_on date not null,
  kind text not null,                   -- 'age_gender' | 'country' | 'city' | 'active_hours'
  data jsonb not null,
  primary key (connection_id, captured_on, kind)
);

-- Catálogo de métricas: mapea clave canónica → nombre en cada plataforma/versión
create table public.social_metric_catalog (
  platform text not null, canonical text not null, api_metric text not null,
  level text not null,                  -- account | post | audience
  period text, active boolean not null default true,
  primary key (platform, canonical, level)
);
```

Grants sugeridos: `authenticated` solo `select` en las tres tablas de métricas (las escribe el sync con `service_role`), `service_role` con `select, insert, update, delete`. Políticas de lectura: `is_workspace_member(workspace_id)` y `is_client_user(client_id)` para el portal.

Cambios en `social_connections`: ampliar `platform` a `'facebook_page' | 'instagram_business' | 'tiktok'`, agregar `auth_method` (`facebook_login` | `instagram_login` | `system_user` | `tiktok_display` | `tiktok_business`) y `sync_cursor jsonb`.

Vincular `social_post_metrics.social_post_id` con el calendario de contenido permite algo que las herramientas pagas no ofrecen: **cruzar rendimiento con lo que la agencia planificó y aprobó** (por pilar de contenido, formato, tipo de copy, etc.).

### 4.3 Edge functions

| Función | `verify_jwt` | Autenticación |
|---|---|---|
| `meta-oauth-start`, `tiktok-oauth-start` | true | JWT del usuario + `can_write_workspace` |
| `meta-oauth-callback`, `tiktok-oauth-callback` | false | `state` HMAC |
| `social-sync-cycle` | false | `X-Sync-Secret` (pg_cron vía pg_net) |
| `social-sync-now` | true | JWT; botón "Sincronizar ahora" de una conexión |
| `meta-data-deletion` | false | `signed_request` de Meta |
| `meta-webhook` *(opcional, historias)* | false | `X-Hub-Signature-256` |
| `generate-report-draft` | true | JWT; arma el borrador de `client_reports` |

Registrar cada una en `supabase/config.toml` siguiendo la convención actual.

**Secretos:** `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `META_GRAPH_VERSION`, `META_SYSTEM_USER_TOKEN` (si se usa la ruta de System User), `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `SOCIAL_OAUTH_STATE_SECRET`, `SOCIAL_SYNC_SECRET`.

### 4.4 Cálculos del reporte mensual

| KPI del reporte | Fórmula a partir de los snapshots |
|---|---|
| Seguidores al cierre / crecimiento | último `followers` del mes − último del mes anterior |
| Alcance / Vistas del mes | IG/FB: suma de diarios. TikTok Display: Σ(view_count fin de mes − inicio) por video |
| Engagement rate | interacciones ÷ alcance (o ÷ seguidores, según la definición de la agencia; documentarlo en `data_notes`) |
| Top posts | `social_post_metrics` publicados en el mes, ordenados por la métrica elegida |
| Comparativa vs. mes anterior | la misma consulta con el rango desplazado |
| Audiencia | último `social_audience_snapshots` del mes |

Detalle importante: el **alcance mensual no es la suma del alcance diario** (las cuentas se repiten). Meta permite pedir `reach` con `period=days_28` o `metric_type=total_value` sobre un rango. Hay que pedirlo así al cerrar el mes y guardarlo como métrica propia (`reach_month`).

---

## 5. Plan por fases

| Fase | Qué | Bloqueado por |
|---|---|---|
| **0 · Trámites (empezar hoy)** | Business Verification de Meta, crear app Business, política de privacidad y endpoint de borrado de datos; app de TikTok en sandbox; solicitud al API for Business de TikTok | Documentos de la empresa |
| **1 · Meta con System User** | Migraciones, `social-sync-cycle`, conexión por socio + System User para los clientes actuales | Fase 0 parcial (no requiere App Review) |
| **2 · Dashboard** | Pestaña "Métricas" en la ficha del cliente y en el portal: KPIs, gráfico diario, top posts, comparativa | Fase 1 con ≥ 2 semanas de datos |
| **3 · Reporte automático** | `generate-report-draft` llena el reporte mensual; el equipo solo escribe análisis y plan | Fase 2 |
| **4 · OAuth self-service + TikTok** | Botón "Conectar" para clientes y otras agencias (Advanced Access), TikTok Display API | App Review de Meta, auditoría de TikTok |
| **5 · TikTok Business** | Alcance, retención, demografía | Aprobación de TikTok for Business |

---

## 6. Riesgos y limitaciones

- **Churn de métricas de Meta.** El catálogo (§4.2) y `source_metric` evitan migraciones de datos. Hay que revisar el changelog en cada versión.
- **Sin historial retroactivo.** Un cliente recién conectado solo tiene ~30 días de seguidores (IG) y ningún historial de contadores en TikTok Display. El primer reporte completo sale el mes siguiente a la conexión. Conviene avisarlo en la UI.
- **Historias de IG.** Si el sync falla más de 24 h, esos datos se pierden.
- **Demografía.** Exige 100+ seguidores y solo devuelve el top 45.
- **Cuentas personales.** IG personal no tiene API de insights. El cliente tiene que pasar a cuenta profesional (Business o Creator).
- **Tokens revocados.** Pasa cuando el cliente cambia la contraseña, quita el socio o un admin sale de la Página. `status` + notificación al equipo + botón de reconexión.
- **Privacidad.** Los datos son agregados, sin datos personales de seguidores, pero igual hay que cubrir el borrado de datos y mencionar la integración en la política de privacidad.

---

## Fuentes

- [Instagram Platform: Insights](https://developers.facebook.com/docs/instagram-platform/insights)
- [Instagram Platform: Changelog](https://developers.facebook.com/docs/instagram-platform/changelog)
- [User and media insights on Instagram API with Instagram Login (Meta, mar 2025)](https://developers.facebook.com/blog/post/2025/03/24/user-and-media-insights-on-instagram-api-with-instagram-login/)
- [Instagram Platform: Overview (niveles de acceso)](https://developers.facebook.com/docs/instagram-platform/overview/)
- [Graph API v25.0 changelog](https://developers.facebook.com/docs/graph-api/changelog/version25.0)
- [Introducing Graph API v25.0 (feb 2026)](https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/)
- [Page Insights API Updates (ago 2025)](https://developers.facebook.com/blog/post/2025/08/15/page-insights-api-updates/)
- [Pages API: deprecated metrics](https://developers.facebook.com/documentation/pages-api/platforminsights/page/deprecated-metrics)
- [TikTok: API scopes](https://developers.tiktok.com/doc/tiktok-api-scopes)
- [TikTok: Video object](https://developers.tiktok.com/doc/tiktok-api-v2-video-object)
- [TikTok API for Business: guía](https://business-api.tiktok.com/portal/docs)
- [Adverity: TikTok Business fields](https://docs.adverity.com/reference/connectors/connector-tiktok-business.html) *(secundaria, nombres de campos del API for Business)*
