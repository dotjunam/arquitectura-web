/**
 * Exige que los pedidos con cuerpo declaren `Content-Type: application/json`.
 *
 * Es negociacion de contenido del lado del servidor: el servidor solo sabe leer
 * un formato y lo dice explicitamente en vez de intentar adivinar.
 */

import { AppError } from '../errors/app-error.js';

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

export function requireJsonBody(req, res, next) {
  if (!METHODS_WITH_BODY.has(req.method)) return next();

  // `req.is` devuelve false tanto si el tipo es otro como si no vino el header.
  if (!req.is('application/json')) {
    return next(
      AppError.unsupportedMediaType(
        "Este endpoint solo acepta 'application/json' en el cuerpo del pedido.",
      ),
    );
  }

  return next();
}
