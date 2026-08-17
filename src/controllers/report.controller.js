/** Controladores de reportes. Son de solo lectura: unicamente GET. */

import { reportService } from '../services/report.service.js';

export const reportController = {
  stockHealth(req, res) {
    res.status(200).json({ data: reportService.stockHealth() });
  },

  marginByCategory(req, res) {
    res.status(200).json({ data: reportService.marginByCategory() });
  },
};
