import { z } from 'zod';
import { ProcesadorPagoSchema } from './webhook-pago.types.js';

/**
 * Compras y tiers.
 *
 * IMPORTANTE: este repositorio es **público** (ADR-001 §A.6). Aquí va la
 * *forma* de una compra, nunca la tabla de precios — esa vive en
 * `perfil-semantico-api`, que es privado. `precio_centavos_mxn` es un dato de
 * cada transacción, no un catálogo.
 */

/**
 * Lo que se cobra en una transacción (Modelo de Negocio §2).
 *
 * - `gratis` — perfil semántico, habilidades y nombres alternativos de posición.
 * - `tier_1` — 5 vacantes reales del día con % de fit + cover letter por cada una.
 * - `tier_2` — solo los strings booleanos, comprados **después** de Tier 1.
 * - `tier_1_2` — Tier 1 y Tier 2 en un mismo checkout, cuando el cliente acepta
 *   el upsell antes de pagar.
 * - `tier_3` — refill: otras 5 vacantes sobre el perfil original, sin regenerarlo.
 * - `reinicio_perfil` — CV nuevo: perfil nuevo y cobro de Tier 1 + Tier 2 juntos.
 *
 * `tier_1_2` existe porque un checkout produce **una** transacción de Openpay, y
 * `openpay_transaction_id` es único: dos filas de compra no pueden compartirlo.
 * Guardar el paquete como un valor propio mantiene esa defensa contra duplicados
 * intacta, y sigue el precedente que el propio modelo ya tenía con
 * `reinicio_perfil`.
 */
export const TierSchema = z.enum([
  'gratis',
  'tier_1',
  'tier_2',
  'tier_1_2',
  'tier_3',
  'reinicio_perfil',
]);
export type Tier = z.infer<typeof TierSchema>;

/**
 * Qué desbloquea cada cobro.
 *
 * Vive en `contracts` y no en `api` o `web` porque es justo la clase de dato que
 * los dos interpretarían distinto: el hub es dinámico y decide qué renderizar a
 * partir del estado de compra (Modelo de Negocio §3). Si `web` olvidara que
 * `tier_1_2` también otorga Tier 2, escondería contenido ya pagado.
 */
export const TIERS_OTORGADOS: Record<Tier, readonly Tier[]> = {
  gratis: [],
  tier_1: ['tier_1'],
  tier_2: ['tier_2'],
  tier_1_2: ['tier_1', 'tier_2'],
  tier_3: ['tier_3'],
  reinicio_perfil: ['tier_1', 'tier_2'],
};

/**
 * ¿El cliente tiene acceso pagado a este tier?
 *
 * Solo cuentan las compras en `pagada`: una compra `pendiente` no da acceso, o
 * bastaría con abrir el checkout para desbloquear contenido.
 *
 * No sirve para Tier 3, que es acumulable — ahí interesa *cuántos* refills
 * compró, no si compró alguno.
 */
export function tieneAcceso(
  compras: readonly Pick<Compra, 'tier' | 'estado_pago'>[],
  tier: Tier,
): boolean {
  return compras.some(
    (c) => c.estado_pago === 'pagada' && TIERS_OTORGADOS[c.tier].includes(tier),
  );
}

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
  id: z.uuid(),
  /**
   * `null` significa que el perfil fue suprimido y esta fila solo se conserva
   * como registro fiscal.
   *
   * En la práctica un cliente nunca recibe una fila así: las políticas RLS
   * resuelven la propiedad a través del perfil, así que una compra huérfana es
   * invisible con cualquier JWT de usuario y solo la ve `service_role`.
   */
  perfil_id: z.uuid().nullable(),
  /**
   * Copia del correo **al momento de la compra**, no una referencia.
   *
   * Es el identificador fiscal de la transacción: hay obligación legal de
   * conservar la información de consumo al menos un año, y esta copia es lo que
   * permite que la compra sobreviva a la supresión del perfil. También es la
   * dirección a la que se envió el recibo, que puede no coincidir con el correo
   * actual del cliente.
   */
  email_cliente: z.email(),
  tier: TierSchema,
  precio_centavos_mxn: z.number().int().nonnegative(),
  temporada: TemporadaSchema,
  estado_pago: EstadoPagoSchema,
  /** Qué procesador cobró. Hoy siempre `paypal`. */
  procesador: ProcesadorPagoSchema,
  /**
   * Id de la transacción en el procesador — en PayPal, el id de la **captura**,
   * no el del evento de webhook. Nulo mientras la compra está `pendiente` y aún
   * no hay checkout creado. Con constraint único en la base: es la primera línea
   * de defensa contra duplicados (documento fuente §3).
   */
  transaccion_id: z.string().nullable(),
  /**
   * Ruta en Storage de la **guía para redactar la cover letter** (ADR-001 §A.22).
   *
   * Cuelga de la compra y no de cada vacante porque es **una sola guía**, no una
   * carta por vacante: repetir la misma ruta en las cinco filas, o colgarla de
   * una elegida al azar, mentiría sobre la forma del dato.
   *
   * Nula mientras el entregable no se ha generado, y también en los tiers que no
   * la incluyen. Se firma al servir, nunca se persiste firmada.
   */
  guia_path: z.string().nullable(),
  /**
   * Cuándo se envió el correo de confirmación de compra vía Resend, que incluye
   * el recibo emitido por el procesador. `null` = no enviado.
   *
   * **No es el CFDI.** La factura se emite manualmente vía
   * `facturas@fanware.com.mx` y no se rastrea aquí. Si algún día hiciera falta,
   * va en un campo aparte — no reutilizar este.
   */
  recibo_enviado_at: z.iso.datetime().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
export type Compra = z.infer<typeof CompraSchema>;

/**
 * Una compra tal como se le sirve al navegador: la ruta de Storage ya resuelta a
 * una URL firmada de expiración corta (documento fuente §9).
 *
 * Es un tipo distinto del de la tabla a propósito, y hereda el papel que tenía
 * `VacanteServida` antes de que la guía se mudara aquí. Si fueran el mismo, sería
 * fácil filtrar una ruta cruda al cliente —que no le sirve de nada, porque el
 * bucket es privado— o persistir una URL que caduca en minutos.
 */
export const CompraServidaSchema = CompraSchema.omit({ guia_path: true }).extend({
  /** URL firmada de la guía, o `null` si todavía no existe o el tier no la incluye. */
  guia_url_firmada: z.url().nullable(),
});
export type CompraServida = z.infer<typeof CompraServidaSchema>;

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
  perfil_id: z.uuid(),
});
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

export const CheckoutResponseSchema = z.object({
  compra_id: z.uuid(),
  checkout_url: z.url(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;
