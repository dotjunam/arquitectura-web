/**
 * Repositorio de titulos con persistencia en memoria.
 *
 * Toda la aplicacion habla contra esta interfaz y nunca contra la estructura de
 * datos concreta. Si mas adelante se reemplaza el Map por una base de datos,
 * cambia este archivo y nada mas.
 */

import { readFileSync } from 'node:fs';

const SEED_URL = new URL('../data/titles.seed.json', import.meta.url);

/** Copia profunda de lo necesario: `genres` es un arreglo y se copia aparte. */
function clone(title) {
  return { ...title, genres: [...title.genres] };
}

class TitleRepository {
  /** @type {Map<number, object>} */
  #titles = new Map();
  #nextId = 1;

  constructor() {
    this.reset();
  }

  /**
   * Carga automatica de datos por defecto (seed). Se corre al instanciar, asi
   * que la aplicacion nunca arranca vacia y se puede evaluar sin cargar nada a
   * mano. Tambien sirve para volver al estado inicial en las pruebas.
   */
  reset() {
    const seed = JSON.parse(readFileSync(SEED_URL, 'utf-8'));
    this.#titles = new Map(seed.map((title) => [title.id, clone(title)]));
    this.#nextId = Math.max(...seed.map((title) => title.id)) + 1;
    return this.#titles.size;
  }

  /** Devuelve copias para que nadie modifique el almacenamiento por referencia. */
  findAll() {
    return [...this.#titles.values()].map(clone);
  }

  findById(id) {
    const title = this.#titles.get(id);
    return title ? clone(title) : null;
  }

  /** La identidad de negocio de un titulo es su nombre mas su ano de estreno. */
  findByTitleAndYear(title, year) {
    const normalized = title.trim().toLowerCase();
    const found = [...this.#titles.values()].find(
      (item) => item.title.toLowerCase() === normalized && item.year === year,
    );
    return found ? clone(found) : null;
  }

  create(data) {
    const title = { id: this.#nextId, ...data };
    this.#titles.set(title.id, clone(title));
    this.#nextId += 1;
    return clone(title);
  }

  /** Guarda un titulo ya existente pisandolo entero. */
  save(title) {
    this.#titles.set(title.id, clone(title));
    return clone(title);
  }

  remove(id) {
    return this.#titles.delete(id);
  }

  count() {
    return this.#titles.size;
  }
}

// Una sola instancia compartida: el estado en memoria tiene que ser el mismo
// para todos los pedidos.
export const titleRepository = new TitleRepository();
