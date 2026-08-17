/**
 * Controladores de productos: traducen HTTP a llamadas al servicio y de vuelta.
 *
 * No tienen logica de negocio. Lo unico que deciden es que status code y que
 * headers corresponden a cada resultado.
 */

import { config } from '../config/index.js';
import { productService } from '../services/product.service.js';

export const productController = {
  list(req, res) {
    const { data, meta } = productService.list(req.query);
    res.status(200).json({ data, meta });
  },

  getById(req, res) {
    res.status(200).json({ data: productService.getById(req.productId) });
  },

  create(req, res) {
    const product = productService.create(req.body);
    // 201 mas Location: el cliente se entera de donde quedo el recurso nuevo
    // sin tener que adivinar la URL.
    res
      .status(201)
      .location(`${config.apiPrefix}/products/${product.id}`)
      .json({ data: product });
  },

  replace(req, res) {
    res.status(200).json({ data: productService.replace(req.productId, req.body) });
  },

  update(req, res) {
    res.status(200).json({ data: productService.update(req.productId, req.body) });
  },

  remove(req, res) {
    productService.remove(req.productId);
    // 204: la baja salio bien y no hay nada util que devolver.
    res.status(204).end();
  },
};
