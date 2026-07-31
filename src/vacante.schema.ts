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
  id: z.uuid(),
  compra_id: z.uuid(),
  puesto: z.string().min(1),
  empresa: z.string().min(1),
  /** Porcentaje de fit contra el perfil semántico, 0-100. */
  fit_pct: z.number().int().min(0).max(100),
  /** Enlace a la publicación original de la vacante. */
  url_vacante: z.url(),
  /** Fecha en que se capturó la vacante (ISO 8601, solo fecha). */
  snapshot_fecha: z.iso.date(),
});
export type VacanteRecomendada = z.infer<typeof VacanteRecomendadaSchema>;

/**
 * Tabla `strings_booleanos`. Resultado de Tier 2.
 *
 * Extiende el valor en el tiempo: el candidato sigue buscando por su cuenta
 * cuando se le acaban las 5 vacantes entregadas (Modelo de Negocio §2).
 */
export const StringBooleanoSchema = z.object({
  id: z.uuid(),
  compra_id: z.uuid(),
  /** La cadena de búsqueda booleana lista para pegar en un portal de empleo. */
  contenido: z.string().min(1),
});
export type StringBooleano = z.infer<typeof StringBooleanoSchema>;

// ---------------------------------------------------------------------------
// Nota sobre `VacanteServida`, que existió hasta la v0.8.0
// ---------------------------------------------------------------------------
//
// Había un tipo aparte para "la vacante tal como se le sirve al navegador",
// porque la fila traía `cover_letter_path` y al servirla había que cambiarla por
// una URL firmada. Desde que Tier 1 entrega **una guía por compra** y no una
// carta por vacante (ADR-001 §A.22), la vacante ya no tiene ninguna ruta de
// Storage: lo que se guarda y lo que se sirve son idénticos, y mantener dos
// nombres para la misma forma solo invitaba a preguntarse cuál usar.
//
// La distinción no se perdió, se mudó: ahora vive en `CompraServida`, que es
// donde quedó la ruta que hay que firmar.
