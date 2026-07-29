import { z } from 'zod';

/**
 * Compras y tiers.
 *
 * IMPORTANTE: este repositorio es **público** (ADR-001 §A.6). Aquí va la
 * *forma* de una compra, nunca la tabla de precios — esa vive en
 * `perfil-semantico-api`, que es privado. `precio_centavos_mxn` es un dato de
 * cada transacción, no un catálogo.
 */

/**
 * Los cinco tiers (Modelo de Negocio §2).
 *
 * - `gratis` — perfil semántico, habilidades y nombres alternativos de posición.
 * - `tier_1` — 5 vacantes reales del día con % de fit + cover letter por cada una.
 * - `tier_2` — añade strings booleanos de búsqueda sobre el mismo perfil.
 * - `tier_3` — refill: otras 5 vacantes sobre el perfil original, sin regenerarlo.
 * - `reinicio_perfil` — CV nuevo: perfil nuevo y cobro de Tier 1 + Tier 2 juntos.
 */
export const TierSchema = z.enum([
  'gratis',
  'tier_1',
  'tier_2',
  'tier_3',
  'reinicio_perfil',
]);
export type Tier = z.infer<typeof TierSchema>;

/**
 * Temporada de precios vigente al momento de la compra (Modelo de Negocio §5).
 *
 * Se persiste en cada compra para que la decisión de negocio pendiente — si el
 * derecho a Tier 3 se congela al precio original o paga el vigente — se pueda
 * aplicar después sin haber perdido el dato.
 */
export const TemporadaSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type Temporada = z.infer<typeof TemporadaSchema>;

/**
 * Estado del pago.
 *
 * `pendiente` y `expirada` vienen del documento fuente §4: toda compra nace en
 * `pendiente` al crear el checkout, y pasa a `expirada` si sigue así tras el
 * umbral largo (~24h). `fallida` se añadió en Fase 1 porque un rechazo explícito
 * de Openpay no es lo mismo que expirar por silencio: el rechazo se le puede
 * comunicar al cliente de inmediato.
 */
export const EstadoPagoSchema = z.enum([
  'pendiente',
  'pagada',
  'fallida',
  'expirada',
]);
export type EstadoPago = z.infer<typeof EstadoPagoSchema>;

/**
 * Tabla `compras`.
 *
 * `precio_centavos_mxn` guarda **el monto realmente cobrado en esta
 * transacción**, en centavos y como entero — nunca flotantes para dinero. Se
 * desvía del nombre `precio_mxn` del documento fuente §3 justamente para que la
 * unidad quede explícita en el nombre y nadie multiplique por 100 dos veces.
 */
export const CompraSchema = z.object({
  id: z.string().uuid(),
  perfil_id: z.string().uuid(),
  tier: TierSchema,
  precio_centavos_mxn: z.number().int().nonnegative(),
  temporada: TemporadaSchema,
  estado_pago: EstadoPagoSchema,
  /**
   * Id de transacción de Openpay. Nulo mientras la compra está `pendiente` y
   * aún no hay sesión de checkout creada. Con constraint único en la base:
   * es la primera línea de defensa contra duplicados (documento fuente §3).
   */
  openpay_transaction_id: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Compra = z.infer<typeof CompraSchema>;

// ---------------------------------------------------------------------------
// Contratos de API (ADR-001 §5)
// ---------------------------------------------------------------------------

/**
 * `POST /checkout/:tier`.
 *
 * El precio no viaja en la petición: lo resuelve el Worker a partir del tier y
 * de la temporada vigente. Aceptar un precio del cliente sería manipulable.
 */
export const CheckoutRequestSchema = z.object({
  perfil_id: z.string().uuid(),
});
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

export const CheckoutResponseSchema = z.object({
  compra_id: z.string().uuid(),
  checkout_url: z.string().url(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;
