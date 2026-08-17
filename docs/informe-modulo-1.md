# Informe: servidor HTTP con Node.js

**Actividad individual, módulo 1. Arquitectura Web, Universidad de Palermo, 2do cuatrimestre 2026.**
Alumno: junam · Profesor: Ing. Diego Marafetti

---

## Entorno y método de instalación

| | |
|---|---|
| **Sistema operativo** | Windows 11 Home, versión 10.0.26200 |
| **Método de instalación** | Instalación local del paquete LTS mediante el gestor de paquetes `winget` (`winget install OpenJS.NodeJS.LTS`), sin contenedor Docker |
| **Versión de Node.js** | _(pendiente: completar con la salida de `node --version`)_ |
| **Versión de npm** | _(pendiente: completar con la salida de `npm --version`)_ |

Se optó por la instalación local en lugar de la dockerizada porque el equipo no tenía Docker instalado y la actividad no lo requiere: el runtime se va a usar durante toda la cursada, así que conviene tenerlo disponible directamente en el sistema.

### Verificación de la instalación

```
$ node --version
(pendiente)

$ npm --version
(pendiente)
```

---

## Implementación

El servidor está en [`modulo-1/server.js`](../modulo-1/server.js) y usa **exclusivamente el módulo nativo `http`**, sin Express ni ninguna otra dependencia. Se levanta con:

```bash
npm run modulo1
```

Expone dos rutas:

| Verbo y ruta | Respuesta |
|---|---|
| `GET /` | `200` y el texto `Servidor funcionando correctamente` |
| `POST /archivo` | `200` y el texto `Bytes recibidos: <n>` |
| cualquier otra | `404` y el texto `Recurso no encontrado` |

### Decisiones de implementación

**El ruteo se hace a mano.** Sin framework no hay tabla de rutas: lo único que identifica al pedido son `req.method` y `req.url`, y hay que compararlos dentro del callback de `http.createServer()`.

**El conteo de bytes se acumula por fragmento.** El cuerpo del pedido no llega entero ni de una sola vez: `req` es un *stream* legible y el contenido aparece fragmentado en *chunks* a medida que se recibe. Cada chunk es un `Buffer`, así que su `length` ya está en bytes y no en caracteres, que es la razón por la que el conteo funciona igual con contenido binario y con texto.

**La respuesta se emite recién en el evento `end`.** Contestar dentro del evento `data` devolvería un conteo parcial, porque en ese momento todavía pueden estar viajando fragmentos. Solo `end` garantiza que no va a llegar más contenido.

**Se contempla el corte de la conexión.** Si el envío se interrumpe a mitad de camino, el evento `error` del stream responde `400` en lugar de devolver un número incompleto como si fuera correcto.

Este ejercicio es el motivo por el que existe el header `Content-Length`: el servidor no sabe de antemano cuánto va a recibir, y tiene que contarlo o que se lo digan.

---

## Evidencia de prueba

Se generó un archivo binario de prueba de 2048 bytes y se probaron las dos rutas con `curl`, más una ruta inexistente para verificar el `404`.

```
(pendiente: pegar acá la salida real de los comandos curl)
```

---

## Dificultades encontradas

_(pendiente: completar tras la instalación y las pruebas)_
