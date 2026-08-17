/**
 * Controladores de titulos: traducen HTTP a llamadas al servicio y de vuelta.
 *
 * No tienen logica de negocio. Lo unico que deciden es que status code y que
 * headers corresponden a cada resultado.
 */

import { config } from '../config/index.js';
import { titleService } from '../services/title.service.js';

export const titleController = {
  list(req, res) {
    const { data, meta } = titleService.list(req.query);
    res.status(200).json({ data, meta });
  },

  getById(req, res) {
    res.status(200).json({ data: titleService.getById(req.titleId) });
  },

  create(req, res) {
    const title = titleService.create(req.body);
    // 201 mas Location: el cliente se entera de donde quedo el recurso nuevo
    // sin tener que adivinar la URL.
    res
      .status(201)
      .location(`${config.apiPrefix}/titles/${title.id}`)
      .json({ data: title });
  },

  replace(req, res) {
    res.status(200).json({ data: titleService.replace(req.titleId, req.body) });
  },

  update(req, res) {
    res.status(200).json({ data: titleService.update(req.titleId, req.body) });
  },

  remove(req, res) {
    titleService.remove(req.titleId);
    // 204: la baja salio bien y no hay nada util que devolver.
    res.status(204).end();
  },
};
