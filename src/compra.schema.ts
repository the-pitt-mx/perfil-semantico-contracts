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
 * - `tier_1` — hasta 5 vacantes reales con % de fit + guía para redactar la
 *   cover letter + Perfil Semántico Ejecutivo (ADR-001 §A.48).
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
 * ¿Este cobro entrega el Perfil Semántico Ejecutivo (ADR-001 §A.48)?
 *
 * Va con Tier 1, no con Tier 3: es siembra de marca hacia reclutadores y por eso
 * entra en el tier de más volumen. `tier_1`, `tier_1_2` y `reinicio_perfil` sí;
 * `tier_3` (refill) no. Se resuelve con `TIERS_OTORGADOS` y no comparando el tier
 * a mano, o se olvidaría `reinicio_perfil`.
 *
 * Tres consumidores que tienen que coincidir, como en `prometeVacantes`: el
 * generador (lo renderiza al entregar), el panel (decide si mostrar la descarga)
 * y la supresión ARCO (la migración 0032 limpia su ruta).
 */
export function prometeEjecutivo(tier: Tier): boolean {
  return TIERS_OTORGADOS[tier].includes('tier_1');
}

/**
 * ¿Este tier exige aceptar el consentimiento de compra antes de cobrar?
 *
 * **Toda compra de pago.** Desde §9.1 de los Términos (2026-08-29) cada compra
 * registra que el candidato solicitó la ejecución inmediata del servicio y
 * reconoce que, entregado el resultado, el servicio queda prestado — es lo que
 * sostiene que no aplique el retracto de cinco días hábiles del art. 56 LFPC.
 * Los tiers que además redactan un CV suman una cláusula propia; ver
 * `textoTerminos`.
 *
 * `gratis` no se cobra, así que no acepta nada.
 */
export function exigeTerminos(tier: Tier): boolean {
  return tier !== 'gratis';
}

/**
 * El reconocimiento que **toda compra de pago** registra antes de cobrar.
 *
 * Vive en `contracts` y no en la web porque la versión aceptada se persiste en
 * `compras.terminos_version`: si el texto cambiara y no quedara constancia de
 * cuál se aceptó, lo guardado dejaría de probar nada. Cambiar este texto o
 * `TEXTO_TERMINOS_CV` obliga a subir `VERSION_TERMINOS_COMPRA`.
 */
export const TEXTO_TERMINOS_COMPRA =
  'Entiendo que este es un servicio de análisis y generación que se ejecuta al ' +
  'confirmar el pago, y solicito que empiece de inmediato. Una vez que el ' +
  'resultado está disponible en mi panel, el servicio se considera prestado y no ' +
  'procede la devolución por cambio de opinión, sin perjuicio de las garantías y ' +
  'los supuestos de reembolso del punto 9 de los Términos.';

/**
 * Cláusula que se **suma** para los tiers que redactan un CV (`prometeCv`). Antes
 * era el texto único (`VERSION_TERMINOS_CV`, retirado): el CV es el único
 * entregable que la persona presenta como suyo ante un tercero, así que lo que
 * edite después tiene consecuencias para ella.
 */
export const TEXTO_TERMINOS_CV =
  'Además, sobre el CV redactado: se construye solo con lo que dicen mi CV y mi ' +
  'perfil semántico. Fanware no añade experiencia, títulos ni habilidades que yo ' +
  'no haya declarado. Lo que edite a partir de aquí es mío; si se infla o se ' +
  'inventa información, las consecuencias son para mí y Fanware no responde por ' +
  'ellas.';

/**
 * El texto completo que se muestra y se acepta en el checkout de `tier`: el
 * reconocimiento de compra, y la cláusula del CV cuando el tier lo redacta.
 *
 * Una sola casilla y un solo número de versión. La versión N mapea de forma
 * determinista a "qué se mostró" a partir del tier, así que reconstruirlo más
 * tarde no necesita guardar el texto entero.
 */
export function textoTerminos(tier: Tier): string {
  return prometeCv(tier) ? `${TEXTO_TERMINOS_COMPRA}\n\n${TEXTO_TERMINOS_CV}` : TEXTO_TERMINOS_COMPRA;
}

/**
 * Sube cada vez que cambie `TEXTO_TERMINOS_COMPRA` o `TEXTO_TERMINOS_CV`. Se
 * guarda en `compras.terminos_version`.
 *
 * Empieza en 2: la versión 1 fue el texto solo-CV de preproducción
 * (`VERSION_TERMINOS_CV`, retirado el 2026-08-29), y ninguna compra de un tercero
 * la registró.
 */
export const VERSION_TERMINOS_COMPRA = 2;

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
  /** Qué procesador cobró: `paypal` o `openpay`. */
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
   * Ruta en Storage del **Perfil Semántico Ejecutivo** (ADR-001 §A.48): una
   * página para reclutador con el nombre, el título, la síntesis y las
   * habilidades clave del perfil, reformateadas de forma determinista.
   *
   * Cuelga de la compra por consistencia con `guia_path`: el perfil es la vía
   * gratuita, la compra es lo pagado. Nula mientras no se genera y en los tiers
   * que no otorgan Tier 1 (ver `prometeEjecutivo`). Se firma al servir, nunca se
   * persiste firmada.
   */
  perfil_ejecutivo_path: z.string().nullable(),
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
   * Cuándo aceptó el consentimiento de compra (§9.1 de los Términos). Toda compra
   * de pago lo registra desde el 2026-08-29; `null` solo en filas anteriores y en
   * las `gratis`.
   *
   * Vive en `compras` y **no** en una tabla de entregables a propósito: es parte
   * del contrato, no del contenido. Por eso tiene que sobrevivir a la supresión de
   * datos personales junto a la compra — el día que hiciera falta demostrar qué se
   * aceptó es precisamente después de que alguien pidiera borrar sus datos.
   */
  terminos_aceptados_at: z.iso.datetime().nullable(),
  /**
   * Qué versión del texto aceptó (`VERSION_TERMINOS_COMPRA`).
   *
   * Sin esto, guardar la fecha no prueba nada: si el texto cambiara, lo aceptado
   * dejaría de ser lo que hoy se muestra. `null` en las filas anteriores al
   * consentimiento universal y en las `gratis`.
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
export const CompraServidaSchema = CompraSchema.omit({
  guia_path: true,
  perfil_ejecutivo_path: true,
}).extend({
  /** URL firmada de la guía, o `null` si todavía no existe o el tier no la incluye. */
  guia_url_firmada: z.url().nullable(),
  /**
   * URL firmada del Perfil Semántico Ejecutivo, o `null` si todavía no existe o
   * el tier no otorga Tier 1.
   */
  perfil_ejecutivo_url_firmada: z.url().nullable(),
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
   * La versión del texto de consentimiento (`VERSION_TERMINOS_COMPRA`) que el
   * candidato aceptó. **Requerida en toda compra**: desde §9.1 de los Términos
   * cada compra registra la solicitud de ejecución inmediata del servicio.
   *
   * Viaja el **número de versión**, no un booleano: un `acepto: true` no dice
   * *qué* aceptó, y el día que el texto cambie no habría forma de saber si la
   * casilla que marcó decía lo mismo que la de hoy. El Worker lo compara contra
   * su propia `VERSION_TERMINOS_COMPRA` y rechaza si no coinciden — una web con
   * caché vieja estaría recogiendo el consentimiento de un texto que ya no es.
   */
  terminos_version: z.number().int().positive(),
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
