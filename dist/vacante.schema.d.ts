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
export declare const VacanteRecomendadaSchema: z.ZodObject<{
    id: z.ZodUUID;
    compra_id: z.ZodUUID;
    puesto: z.ZodString;
    empresa: z.ZodString;
    fit_pct: z.ZodNumber;
    url_vacante: z.ZodURL;
    motivo: z.ZodString;
    snapshot_fecha: z.ZodISODate;
}, z.core.$strip>;
export type VacanteRecomendada = z.infer<typeof VacanteRecomendadaSchema>;
/**
 * Tabla `strings_booleanos`. Resultado de Tier 2.
 *
 * Extiende el valor en el tiempo: el candidato sigue buscando por su cuenta
 * cuando se le acaban las 5 vacantes entregadas (Modelo de Negocio §2).
 */
export declare const StringBooleanoSchema: z.ZodObject<{
    id: z.ZodUUID;
    compra_id: z.ZodUUID;
    etiqueta: z.ZodString;
    contenido: z.ZodString;
}, z.core.$strip>;
export type StringBooleano = z.infer<typeof StringBooleanoSchema>;
