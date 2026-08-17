/**
 * Repositorio de productos con persistencia en memoria.
 *
 * Toda la aplicacion habla contra esta interfaz y nunca contra la estructura de
 * datos concreta. Si mas adelante se reemplaza el Map por una base de datos,
 * cambia este archivo y nada mas.
 */

import { readFileSync } from 'node:fs';

const SEED_URL = new URL('../data/products.seed.json', import.meta.url);

class ProductRepository {
  /** @type {Map<number, object>} */
  #products = new Map();
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
    this.#products = new Map(seed.map((product) => [product.id, { ...product }]));
    this.#nextId = Math.max(...seed.map((product) => product.id)) + 1;
    return this.#products.size;
  }

  /** Devuelve copias para que nadie modifique el almacenamiento por referencia. */
  findAll() {
    return [...this.#products.values()].map((product) => ({ ...product }));
  }

  findById(id) {
    const product = this.#products.get(id);
    return product ? { ...product } : null;
  }

  findByCode(code) {
    const found = [...this.#products.values()].find((product) => product.code === code);
    return found ? { ...found } : null;
  }

  create(data) {
    const product = { id: this.#nextId, ...data };
    this.#products.set(product.id, product);
    this.#nextId += 1;
    return { ...product };
  }

  /** Guarda un producto ya existente pisandolo entero. */
  save(product) {
    this.#products.set(product.id, { ...product });
    return { ...product };
  }

  remove(id) {
    return this.#products.delete(id);
  }

  count() {
    return this.#products.size;
  }
}

// Una sola instancia compartida: el estado en memoria tiene que ser el mismo
// para todos los pedidos.
export const productRepository = new ProductRepository();
