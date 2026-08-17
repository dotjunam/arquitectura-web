/**
 * Error de aplicacion con status HTTP asociado.
 *
 * La idea es que las capas de servicio no sepan nada de Express: tiran un
 * AppError y el manejador de errores lo traduce a una respuesta HTTP. Asi el
 * status code lo decide la regla de negocio y no el controlador.
 */

export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** 400: el pedido esta mal formado o los parametros no se entienden. */
  static badRequest(message, details) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  /** 404: el recurso pedido no existe. */
  static notFound(message) {
    return new AppError(404, 'NOT_FOUND', message);
  }

  /** 409: el pedido choca contra el estado actual del recurso. */
  static conflict(message, details) {
    return new AppError(409, 'CONFLICT', message, details);
  }

  /** 415: el formato del body no es uno que el servidor sepa leer. */
  static unsupportedMediaType(message) {
    return new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }

  /**
   * 422: el body esta bien formado y se entiende, pero viola una regla de
   * negocio. Es la diferencia con el 400, que es un problema de forma.
   */
  static unprocessableEntity(message, details) {
    return new AppError(422, 'UNPROCESSABLE_ENTITY', message, details);
  }
}
