/** Todavía no se ha conectado Google (no hay refresh token guardado). */
export class GoogleNoConectadoError extends Error {
  constructor() {
    super("Google no está conectado");
    this.name = "GoogleNoConectadoError";
  }
}

/** El refresh token ya no sirve (revocado o caducado): hay que volver a conectar. */
export class GoogleReconectarError extends Error {
  constructor() {
    super("La conexión con Google caducó o fue revocada");
    this.name = "GoogleReconectarError";
  }
}

/** Google respondió con un error al llamar a una de sus APIs. */
export class GoogleApiError extends Error {
  status: number;
  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.name = "GoogleApiError";
    this.status = status;
  }
}
