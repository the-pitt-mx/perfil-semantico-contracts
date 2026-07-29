import { z } from 'zod';

/**
 * Entregables de pago: vacantes reales (Tier 1 y 3) y strings booleanos (Tier 2).
 *
 * `VacanteRecomendada` es una vacante concreta en una empresa concreta, con
 * enlace a la publicación externa. No confundir con `PosicionAlternativa` de
 * `perfil.schema.ts`, que es un nombre de puesto del entregable gratis y no
 * tiene empresa ni enlace. Ver ADR-001 §B.10.
 */

/**
 * Tabla `vacantes_recomendadas`. Resultado de Tier 1 y Tier 3.
 *
 * Es un **snapshot del día**: una vacante encontrada en un momento dado, que
 * puede cerrarse después. Por eso `snapshot_fecha` es parte del dato y no
 * metadato — el cliente compró la foto de ese día, no una lista viva.
 */
export const VacanteRecomendadaSchema = z.object({
  id: z.string().uuid(),
  compra_id: z.string().uuid(),
  puesto: z.string().min(1),
  empresa: z.string().min(1),
  /** Porcentaje de fit contra el perfil semántico, 0-100. */
  fit_pct: z.number().int().min(0).max(100),
  /** Enlace a la publicación original de la vacante. */
  url_vacante: z.string().url(),
  /** Ruta en el bucket privado de la cover letter. Se firma al servir. */
  cover_letter_path: z.string().nullable(),
  /** Fecha en que se capturó la vacante (ISO 8601, solo fecha). */
  snapshot_fecha: z.string().date(),
});
export type VacanteRecomendada = z.infer<typeof VacanteRecomendadaSchema>;

/**
 * Tabla `strings_booleanos`. Resultado de Tier 2.
 *
 * Extiende el valor en el tiempo: el candidato sigue buscando por su cuenta
 * cuando se le acaban las 5 vacantes entregadas (Modelo de Negocio §2).
 */
export const StringBooleanoSchema = z.object({
  id: z.string().uuid(),
  compra_id: z.string().uuid(),
  /** La cadena de búsqueda booleana lista para pegar en un portal de empleo. */
  contenido: z.string().min(1),
});
export type StringBooleano = z.infer<typeof StringBooleanoSchema>;

// ---------------------------------------------------------------------------
// Vista compuesta para el hub del cliente
// ---------------------------------------------------------------------------

/**
 * Una vacante tal como se le sirve al navegador: las rutas de Storage ya
 * resueltas a URLs firmadas con expiración corta (documento fuente §9).
 *
 * Es un tipo distinto del de la tabla a propósito. Si fueran el mismo, sería
 * fácil filtrar una ruta cruda al cliente o persistir una URL firmada caducable.
 */
export const VacanteServidaSchema = VacanteRecomendadaSchema.omit({
  cover_letter_path: true,
}).extend({
  cover_letter_url_firmada: z.string().url().nullable(),
});
export type VacanteServida = z.infer<typeof VacanteServidaSchema>;
