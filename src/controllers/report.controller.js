/** Controladores de reportes. Son de solo lectura: unicamente GET. */

import { reportService } from '../services/report.service.js';

export const reportController = {
  watchStats(req, res) {
    res.status(200).json({ data: reportService.watchStats() });
  },

  ratingByGenre(req, res) {
    res.status(200).json({ data: reportService.ratingByGenre() });
  },
};
