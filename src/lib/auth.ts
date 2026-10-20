/**
 * Panel de Vida es de uso personal: solo un correo puede entrar.
 * Si ALLOWED_EMAIL no está definida, la app se cierra por completo (falla segura).
 */
export function getAllowedEmail(): string {
  const email = process.env.ALLOWED_EMAIL;
  if (!email) {
    throw new Error("Falta la variable de entorno ALLOWED_EMAIL");
  }
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getAllowedEmail();
}
