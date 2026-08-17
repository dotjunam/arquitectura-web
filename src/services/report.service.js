/**
 * Reportes derivados del catalogo.
 *
 * Son de solo lectura y se calculan al vuelo sobre el estado actual del
 * repositorio: no hay tabla de reportes ni datos duplicados.
 */

import { titleRepository } from '../repositories/title.repository.js';

const TYPES = ['movie', 'series'];

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Minutos totales de un titulo.
 *
 * Una pelicula dura lo que dura; una serie dura la duracion promedio de su
 * episodio multiplicada por la cantidad de episodios. Sin esta distincion,
 * Breaking Bad "duraria" 49 minutos y el reporte no diria nada.
 */
function totalMinutes(title) {
  return title.type === 'series'
    ? title.runtimeMinutes * (title.episodes ?? 0)
    : title.runtimeMinutes;
}

export const reportService = {
  /**
   * Estadisticas de visionado: cuanto se vio, cuanto falta y cuanto tiempo
   * llevo. Es el reporte que responde "que veo ahora" y "cuanto debo".
   */
  watchStats() {
    const titles = titleRepository.findAll();
    const watched = titles.filter((title) => title.watched);
    const pending = titles.filter((title) => !title.watched);
    const rated = titles.filter((title) => title.rating !== null);

    const watchedMinutes = watched.reduce((sum, title) => sum + totalMinutes(title), 0);
    const pendingMinutes = pending.reduce((sum, title) => sum + totalMinutes(title), 0);

    const byType = TYPES.map((type) => {
      const ofType = titles.filter((title) => title.type === type);
      const watchedOfType = ofType.filter((title) => title.watched);
      return {
        type,
        total: ofType.length,
        watched: watchedOfType.length,
        pending: ofType.length - watchedOfType.length,
        watchedHours: round(
          watchedOfType.reduce((sum, title) => sum + totalMinutes(title), 0) / 60,
        ),
      };
    });

    return {
      summary: {
        totalTitles: titles.length,
        watched: watched.length,
        pending: pending.length,
        completionPct: titles.length === 0 ? 0 : round((watched.length / titles.length) * 100),
        watchedHours: round(watchedMinutes / 60),
        pendingHours: round(pendingMinutes / 60),
        averageRating:
          rated.length === 0
            ? null
            : round(rated.reduce((sum, title) => sum + title.rating, 0) / rated.length),
      },
      byType,
      // Lo pendiente mas corto primero: es por donde conviene empezar.
      pending: pending
        .map((title) => ({
          id: title.id,
          title: title.title,
          type: title.type,
          year: title.year,
          totalMinutes: totalMinutes(title),
        }))
        .sort((a, b) => a.totalMinutes - b.totalMinutes),
    };
  },

  /**
   * Puntaje promedio por genero, de mayor a menor.
   *
   * Un titulo con varios generos suma en todos: los generos no son excluyentes,
   * asi que la suma de los conteos por genero es mayor que el total de titulos.
   * Solo entran los titulos puntuados, porque un pendiente no tiene nota.
   */
  ratingByGenre() {
    const titles = titleRepository.findAll();
    const groups = new Map();

    for (const title of titles) {
      for (const genre of title.genres) {
        const group = groups.get(genre) ?? {
          genre,
          titleCount: 0,
          ratedCount: 0,
          ratingSum: 0,
        };
        group.titleCount += 1;
        if (title.rating !== null) {
          group.ratedCount += 1;
          group.ratingSum += title.rating;
        }
        groups.set(genre, group);
      }
    }

    const genres = [...groups.values()]
      .map((group) => ({
        genre: group.genre,
        titleCount: group.titleCount,
        ratedCount: group.ratedCount,
        averageRating: group.ratedCount === 0 ? null : round(group.ratingSum / group.ratedCount),
      }))
      .sort((a, b) => {
        if (a.averageRating === null) return 1;
        if (b.averageRating === null) return -1;
        return b.averageRating - a.averageRating || b.titleCount - a.titleCount;
      });

    return {
      summary: {
        totalTitles: titles.length,
        genres: genres.length,
        // Aclarado a proposito: este numero NO tiene que dar igual al total.
        genreAssignments: genres.reduce((sum, genre) => sum + genre.titleCount, 0),
      },
      genres,
    };
  },
};
