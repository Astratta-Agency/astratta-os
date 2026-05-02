/**
 * Map Supabase auth error messages to Spanish copy.
 * Keep keys lowercase for case-insensitive matching.
 */
const MAP: Record<string, string> = {
  "invalid login credentials": "Correo o contraseña incorrectos.",
  "email not confirmed": "Confirma tu correo antes de iniciar sesión.",
  "user already registered": "Ese correo ya tiene una cuenta. Inicia sesión.",
  "password should be at least 6 characters":
    "La contraseña debe tener al menos 6 caracteres.",
  "signup requires a valid password": "Ingresa una contraseña válida.",
  "email rate limit exceeded":
    "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  "for security purposes, you can only request this after":
    "Por seguridad, espera unos segundos antes de volver a intentarlo.",
};

export function translateAuthError(message?: string | null): string {
  if (!message) return "Ocurrió un error. Inténtalo de nuevo.";
  const key = message.toLowerCase();
  for (const k of Object.keys(MAP)) {
    if (key.includes(k)) return MAP[k];
  }
  return message;
}
