/** Todavía no se han guardado credenciales de Apple. */
export class AppleNoConectadoError extends Error {
  constructor() {
    super("Apple Calendar no está conectado");
    this.name = "AppleNoConectadoError";
  }
}

/** iCloud rechazó el usuario o la contraseña específica. */
export class AppleCredencialesError extends Error {
  constructor() {
    super("iCloud rechazó el Apple ID o la contraseña específica de aplicación");
    this.name = "AppleCredencialesError";
  }
}

/** Cualquier otro fallo al hablar con iCloud. */
export class AppleApiError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "AppleApiError";
  }
}
