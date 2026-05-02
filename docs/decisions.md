# Decisiones técnicas — Astratta OS

Registro de decisiones de arquitectura y lecciones aprendidas. Una entrada por episodio, en orden cronológico inverso.

---

## 2026-05-02 — Race condition + RLS bootstrap en login de agencia

### Contexto

Tras un login exitoso (`POST /token?grant_type=password` → 200), el usuario quedaba atrapado en un loop que lo devolvía a `/login` en vez de avanzar a `/app/dashboard`. En Supabase se confirmó que el usuario tenía una fila válida en `workspace_members` con `role=owner` y `status=active`, y las políticas RLS estaban correctas (`user_id = auth.uid()` como bootstrap).

### Diagnóstico

Combo de dos problemas que se enmascaraban entre sí:

1. **Race condition cliente-side.** El `useQuery` de `useUserContext` se disparaba en el primer render, antes de que `supabase.auth` terminara de hidratar la sesión y adjuntar el JWT al cliente PostgREST. El request salía como anónimo.
2. **RLS legítimamente denegando.** Sin token, `auth.uid()` devolvía `NULL`, las políticas filtraban todo, y la query regresaba `[]` sin error. El guard `RequireAgencyAuth` interpretaba el array vacío como "sin membresía" y redirigía a `/login`.

El síntoma parecía un problema de RLS o de datos, pero la causa raíz era de timing en el cliente.

### Resolución

- `useUserContext`: agregar `enabled: !!user?.id && isSupabaseConfigured` al `useQuery` para que la query nunca corra sin un usuario autenticado en memoria.
- `RequireAgencyAuth`: redefinir `ctxLoading` para incluir el gap entre "sesión lista" y "data lista" (`!isFetched || workspaceMembers === undefined`), y solo redirigir cuando `workspaceMembers` sea explícitamente un array vacío — nunca cuando sea `undefined`.

### Regla a recordar

> **`useQuery` debe gatear con `enabled: !!user?.id` siempre que dependa de auth context. Sin esto, el query corre antes del token y RLS deniega legítimamente.**

Corolarios:

- Un array vacío de una tabla con RLS no es evidencia de "no hay datos" — puede ser "no había token". Distinguir `undefined` (no fetcheado) de `[]` (fetcheado sin resultados) en los guards.
- Los guards de auth deben esperar tanto a `useAuth().loading` como a `isFetched` del contexto antes de decidir redirección.
- Patrón Supabase recomendado: registrar `onAuthStateChange` **antes** de `getSession()` para no perder eventos durante la hidratación.

### Archivos tocados

- `src/hooks/useUserContext.ts`
- `src/hooks/useAuth.ts`
- `src/components/auth/RequireAgencyAuth.tsx`
- `src/components/require-auth.tsx`
