/**
 * Manejador de errores centralizado.
 *
 * Es el unico lugar de la aplicacion que arma una respuesta de error, asi que
 * el formato es siempre el mismo. Express lo reconoce como manejador de errores
 * por tener cuatro parametros: sacar `next` lo convierte en un middleware comun
 * y deja de funcionar.
 */

import { AppError } from '../errors/app-error.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        status: err.status,
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // Errores que tira `express.json()` antes de que el pedido llegue a una ruta.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        status: 400,
        code: 'MALFORMED_JSON',
        message: 'El cuerpo del pedido no es JSON valido.',
      },
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'El cuerpo del pedido supera el tamano maximo permitido.',
      },
    });
  }

  // Cualquier otra cosa es un error no previsto: se registra completo del lado
  // del servidor y al cliente se le da lo minimo, sin filtrar el stack trace.
  console.error('[error no controlado]', err);

  return res.status(500).json({
    error: {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrio un error inesperado en el servidor.',
    },
  });
}
