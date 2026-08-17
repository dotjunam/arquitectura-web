/** Controladores de los recursos derivados del catalogo: generos y directores. */

import { titleService } from '../services/title.service.js';

export const catalogController = {
  listGenres(req, res) {
    res.status(200).json({ data: titleService.listGenres() });
  },

  listDirectors(req, res) {
    res.status(200).json({ data: titleService.listDirectors() });
  },
};
