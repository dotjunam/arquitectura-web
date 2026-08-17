/**
 * Ultimo middleware de la cadena: si el pedido llego hasta aca es porque
 * ninguna ruta lo tomo. Se responde 404 en el mismo formato de error que el
 * resto de la API, en vez del HTML por defecto de Express.
 */

import { AppError } from '../errors/app-error.js';

export function notFound(req, res, next) {
  next(AppError.notFound(`No existe el recurso ${req.method} ${req.originalUrl}.`));
}
