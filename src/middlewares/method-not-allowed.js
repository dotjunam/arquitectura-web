/**
 * Respuesta 405 para una ruta que existe pero no acepta ese metodo.
 *
 * La diferencia con el 404 es informativa y no menor: 404 dice "aca no hay
 * nada", 405 dice "el recurso existe, pero eso no se le puede hacer". Por eso
 * el 405 obliga a mandar el header `Allow` con los metodos que si valen.
 */

import { AppError } from '../errors/app-error.js';

export function methodNotAllowed(allowedMethods) {
  const allow = allowedMethods.join(', ');

  return (req, res, next) => {
    res.set('Allow', allow);
    next(
      new AppError(
        405,
        'METHOD_NOT_ALLOWED',
        `El metodo ${req.method} no esta permitido en este recurso. Metodos aceptados: ${allow}.`,
      ),
    );
  };
}
