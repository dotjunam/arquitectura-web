/** Punto de entrada del backend: levanta la aplicacion y la pone a escuchar. */

import { createApp } from './app.js';
import { config } from './config/index.js';
import { productRepository } from './repositories/product.repository.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`API escuchando en http://localhost:${config.port}`);
  console.log(`Prefijo de la API: ${config.apiPrefix}`);
  console.log(`Productos cargados por el seed: ${productRepository.count()}`);
});

// Cierre ordenado: se deja de aceptar conexiones nuevas y se esperan las que ya
// estaban en curso, en vez de cortar todo de golpe.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\nSenal ${signal} recibida, cerrando el servidor.`);
    server.close(() => process.exit(0));
  });
}
