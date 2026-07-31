import { z } from 'zod';
import { PerfilSemanticoSchema } from './perfil.schema.js';
import { CompraServidaSchema } from './compra.schema.js';
import { StringBooleanoSchema, VacanteRecomendadaSchema } from './vacante.schema.js';

export * from './perfil.schema.js';
export * from './compra.schema.js';
export * from './vacante.schema.js';
export * from './webhook-pago.types.js';

/**
 * `GET /perfil/:clienteId` — lo que alimenta el panel del cliente.
 *
 * El panel es un hub **permanente y dinámico**, no una página estática (Modelo de
 * Negocio §3, donde se le llama "repositorio"): muestra distinto contenido según
 * el estado de compra. Por eso la respuesta trae todo junto y es `web` quien
 * decide qué renderizar, en vez de exigir varias llamadas encadenadas.
 *
 * Qué mostrar se resuelve con `tieneAcceso()`, nunca comparando `compra.tier`
 * directamente: `tier_1_2` y `reinicio_perfil` también otorgan Tier 2.
 *
 * Vive aquí y no en `perfil.schema.ts` porque compone piezas de los tres
 * módulos.
 */
export const PerfilCompletoResponseSchema = z.object({
  perfil: PerfilSemanticoSchema.omit({ pdf_path: true }).extend({
    /** URL firmada de expiración corta, o null si el PDF aún no existe. */
    pdf_url_firmada: z.url().nullable(),
  }),
  /** Con la guía ya firmada: el panel nunca ve rutas de Storage. */
  compras: z.array(CompraServidaSchema),
  /**
   * Sin traducción: desde que la guía es una por compra, la vacante no tiene
   * ninguna ruta que firmar y lo que se guarda es lo que se sirve.
   */
  vacantes: z.array(VacanteRecomendadaSchema),
  strings_booleanos: z.array(StringBooleanoSchema),
});
export type PerfilCompletoResponse = z.infer<
  typeof PerfilCompletoResponseSchema
>;
