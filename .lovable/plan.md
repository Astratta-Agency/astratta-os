Plan:

1. Actualizar `supabase/functions/send-portal-invite/index.ts`
   - Añadir al inicio del handler:
     `console.log("[send-portal-invite] Authorization header:", req.headers.get("Authorization")?.substring(0, 50))`
   - Mantener aceptación estricta de `Authorization: Bearer <token>`.
   - Reemplazar la validación actual con `getClaims(token)` por un cliente request-scoped:
     ```ts
     const authClient = createClient(supabaseUrl, anonKey, {
       global: { headers: { Authorization: authHeader } },
     });
     const { data: userData, error: userErr } = await authClient.auth.getUser();
     ```
   - Si `userErr` o `!userData.user?.id`, devolver `401 { error: "invalid_token" }`.
   - Usar `userData.user.id` para la verificación de membresía existente.

2. Actualizar `supabase/config.toml`
   - Cambiar `send-portal-invite` a `verify_jwt = false`.
   - Esto evita que el runtime bloquee la request antes de que llegue al código, permite ver el log del header y deja la validación JWT explícitamente en la función con `getUser()`.

3. Verificación
   - Confirmar que todas las respuestas siguen incluyendo CORS.
   - Confirmar que el flujo sigue usando service role solo después de validar el usuario.
   - Tras aprobar el plan, aplicar cambios y redeployar la Edge Function desde Lovable/Supabase para que el nuevo `verify_jwt=false` y el código actualizado entren en vigor.