/**
 * Actividad individual - Modulo 1: servidor HTTP con el modulo nativo `http`.
 *
 * Este archivo NO usa Express ni ningun otro framework: es la consigna del
 * ejercicio 3. El backend del Trabajo Practico Integrador, que si usa Express,
 * vive aparte en `src/`.
 */

import http from 'node:http';

const PORT = Number(process.env.PORT ?? 3000);

const PLAIN_TEXT = { 'Content-Type': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  // Sin framework no hay tabla de ruteo: lo unico que identifica al pedido es
  // el metodo y la url, y hay que compararlos a mano.
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, PLAIN_TEXT);
    res.end('Servidor funcionando correctamente\n');
    return;
  }

  if (req.method === 'POST' && req.url === '/archivo') {
    let receivedBytes = 0;

    // El body no llega entero ni de golpe: `req` es un stream legible y el
    // contenido aparece fragmentado en chunks. Cada chunk es un Buffer, asi que
    // su `length` ya son bytes (no caracteres) y se puede acumular directo.
    req.on('data', (chunk) => {
      receivedBytes += chunk.length;
    });

    // Recien `end` garantiza que no va a llegar mas contenido. Contestar antes
    // devolveria un conteo parcial.
    req.on('end', () => {
      res.writeHead(200, PLAIN_TEXT);
      res.end(`Bytes recibidos: ${receivedBytes}\n`);
    });

    // Si la conexion se corta a mitad del envio, el conteo quedaria incompleto:
    // conviene fallar antes que responder un numero que no es.
    req.on('error', () => {
      res.writeHead(400, PLAIN_TEXT);
      res.end('Error al leer el cuerpo del pedido\n');
    });

    return;
  }

  // Cualquier otra combinacion de ruta y metodo no esta contemplada.
  res.writeHead(404, PLAIN_TEXT);
  res.end('Recurso no encontrado\n');
});

server.listen(PORT, () => {
  console.log(`Servidor del modulo 1 escuchando en http://localhost:${PORT}`);
});
