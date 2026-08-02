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
 * `tier_1_2` existe porque un checkout produce **una** transacción en el
 * procesador, y `transaccion_id` es único: dos filas de compra no pueden
 * compartirlo.
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
  'cv_redactado',
  'cv_bilingue',
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
  // Se llama por lo que hace y no `tier_4` a propósito, siguiendo a
  // `reinicio_perfil`. Los dos tocan el CV en direcciones opuestas —uno lo recibe
  // del candidato, el otro se lo entrega— y con nombres numerados sería cuestión
  // de tiempo que alguien escribiera uno donde iba el otro. Es la misma trampa
  // que §B.10 documenta con "posiciones recomendadas".
  cv_redactado: ['cv_redactado'],
  // Otorga también el base: quien compró el bilingüe tiene todo lo que tiene
  // quien compró el sencillo, y `tieneAcceso` lo resuelve sin casos especiales.
  cv_bilingue: ['cv_redactado', 'cv_bilingue'],
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
 * del procesador no es lo mismo que expirar por silencio: el rechazo se le puede
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
 * En qué punto va el entregable de una compra.
 *
 * Es distinto de `estado_pago` y hay que resistir la tentación de juntarlos: el
 * dinero y la entrega fallan por separado, y el caso que más importa —pagada y
 * sin entregar— solo se puede nombrar si son dos ejes.
 *
 * Cuatro estados y no un booleano `entregado`: "todavía no empieza", "está
 * corriendo" y "se rompió" es justo lo que el panel necesita distinguir, y un
 * booleano las aplasta en el mismo silencio.
 */
export const EstadoEntregableSchema = z.enum([
  'pendiente',
  'generando',
  'entregado',
  'fallido',
]);
export type EstadoEntregable = z.infer<typeof EstadoEntregableSchema>;

/**
 * ¿Este cobro promete vacantes?
 *
 * Se resuelve con `TIERS_OTORGADOS` y no comparando el tier a mano, o se
 * olvidaría `reinicio_perfil`, que es el cobro más caro.
 *
 * Vive aquí y no en `api` porque tiene tres consumidores que tienen que coincidir:
 * el generador, el vigilante de compras pagadas sin entregable, y el panel —que
 * necesita saber si esperar algo antes de enseñar "estamos buscando tus
 * vacantes". Si divergieran, el panel prometería lo que nadie va a generar.
 */
export function prometeVacantes(tier: Tier): boolean {
  const otorga = TIERS_OTORGADOS[tier];
  return otorga.includes('tier_1') || otorga.includes('tier_3');
}

/** ¿Este cobro promete strings booleanos de búsqueda? */
export function prometeStrings(tier: Tier): boolean {
  return TIERS_OTORGADOS[tier].includes('tier_2');
}

/** ¿Este cobro promete un CV redactado? */
export function prometeCv(tier: Tier): boolean {
  return TIERS_OTORGADOS[tier].includes('cv_redactado');
}

/**
 * ¿Este tier exige aceptar los términos antes de cobrar?
 *
 * Solo el CV redactado: es el único entregable que la persona presenta como suyo
 * ante un tercero, y por tanto el único donde lo que edite después tiene
 * consecuencias para ella.
 */
export function exigeTerminos(tier: Tier): boolean {
  return prometeCv(tier);
}

/**
 * ¿Hay algo que generar por esta compra?
 *
 * `gratis` no se cobra y no entrega nada por esta vía, así que su entregable no
 * llega nunca a `generando` y el panel no debe quedarse esperándolo.
 */
export function prometeEntregable(tier: Tier): boolean {
  return prometeVacantes(tier) || prometeStrings(tier) || prometeCv(tier);
}

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
  entregable_estado: EstadoEntregableSchema,
  /**
   * Por qué no se pudo entregar, redactado para leerse tal cual en el panel.
   *
   * Mismo papel que `perfiles_semanticos.motivo_fallo`, y por la misma razón: sin
   * él, quien pagó ve que algo no llegó y no sabe si esperar, escribir o dar el
   * dinero por perdido. Nulo salvo en `fallido`, con constraint en la base.
   *
   * No lleva dato personal — lo escribe el Worker, no el modelo.
   */
  entregable_motivo_fallo: z.string().nullable(),
  /**
   * Cuántas veces se ha lanzado la generación del entregable. Tope de gasto: cada
   * intento cuesta puntuación de fit y una llamada a Adzuna.
   */
  entregable_intentos: z.number().int().nonnegative(),
  /**
   * Cuándo aceptó los términos del CV redactado, o `null` si el tier no los pide.
   *
   * Vive en `compras` y **no** en una tabla de entregables a propósito: es parte
   * del contrato, no del contenido. Por eso tiene que sobrevivir a la supresión de
   * datos personales junto a la compra — el día que hiciera falta demostrar qué se
   * aceptó es precisamente después de que alguien pidiera borrar sus datos.
   */
  terminos_aceptados_at: z.iso.datetime().nullable(),
  /**
   * Qué versión del texto aceptó (`VERSION_TERMINOS_CV`).
   *
   * Sin esto, guardar la fecha no prueba nada: si el texto cambiara, lo aceptado
   * dejaría de ser lo que hoy se muestra.
   */
  terminos_version: z.number().int().positive().nullable(),
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
  /**
   * Qué versión de los términos aceptó, en los tiers que los exigen
   * (`exigeTerminos`). Ausente en los demás.
   *
   * Viaja el **número de versión**, no un booleano: un `acepto: true` no dice
   * *qué* aceptó, y el día que el texto cambie no habría forma de saber si la
   * casilla que marcó decía lo mismo que la de hoy. El Worker lo compara contra
   * su propia `VERSION_TERMINOS_CV` y rechaza si no coinciden — una web con
   * caché vieja estaría recogiendo el consentimiento de un texto que ya no es.
   */
  terminos_version: z.number().int().positive().optional(),
});
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

export const CheckoutResponseSchema = z.object({
  compra_id: z.uuid(),
  checkout_url: z.url(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

/**
 * `GET /precios` — la lista vigente, pública y sin sesión.
 *
 * Existe porque el botón de compra necesita una cifra antes de que nadie se
 * identifique, y la cifra depende de `TEMPORADA`, que es variable de entorno del
 * Worker para poder cambiarse sin desplegar. Una copia en el frontend anunciaría
 * $79 el día que el cobro real ya sea $129, y quien lo descubriera lo haría en la
 * pantalla de PayPal.
 *
 * **Aquí va la forma, nunca los importes.** Este paquete es público: los precios
 * y su lógica de temporada viven en el Worker.
 *
 * Es una lista y no un objeto por tier porque el orden es información: es el
 * orden en que conviene enseñarlos.
 */
export const PrecioTierSchema = z.object({
  tier: TierSchema,
  /** Centavos enteros, como en `compras.precio_centavos_mxn`. Nunca flotantes para dinero. */
  centavos: z.number().int().nonnegative(),
  /** Qué se lleva quien lo compre, redactado para mostrarse tal cual. */
  concepto: z.string().min(1),
});
export type PrecioTier = z.infer<typeof PrecioTierSchema>;

export const PreciosResponseSchema = z.object({
  temporada: TemporadaSchema,
  tiers: z.array(PrecioTierSchema),
});
export type PreciosResponse = z.infer<typeof PreciosResponseSchema>;
