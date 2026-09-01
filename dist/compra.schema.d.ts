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
export declare const TierSchema: z.ZodEnum<{
    gratis: "gratis";
    tier_1: "tier_1";
    tier_2: "tier_2";
    tier_1_2: "tier_1_2";
    tier_3: "tier_3";
    reinicio_perfil: "reinicio_perfil";
    cv_redactado: "cv_redactado";
    cv_bilingue: "cv_bilingue";
}>;
export type Tier = z.infer<typeof TierSchema>;
/**
 * Qué desbloquea cada cobro.
 *
 * Vive en `contracts` y no en `api` o `web` porque es justo la clase de dato que
 * los dos interpretarían distinto: el hub es dinámico y decide qué renderizar a
 * partir del estado de compra (Modelo de Negocio §3). Si `web` olvidara que
 * `tier_1_2` también otorga Tier 2, escondería contenido ya pagado.
 */
export declare const TIERS_OTORGADOS: Record<Tier, readonly Tier[]>;
/**
 * ¿El cliente tiene acceso pagado a este tier?
 *
 * Solo cuentan las compras en `pagada`: una compra `pendiente` no da acceso, o
 * bastaría con abrir el checkout para desbloquear contenido.
 *
 * No sirve para Tier 3, que es acumulable — ahí interesa *cuántos* refills
 * compró, no si compró alguno.
 */
export declare function tieneAcceso(compras: readonly Pick<Compra, 'tier' | 'estado_pago'>[], tier: Tier): boolean;
/**
 * Temporada de precios vigente al momento de la compra (Modelo de Negocio §5).
 *
 * Se persiste en cada compra para que la decisión de negocio pendiente — si el
 * derecho a Tier 3 se congela al precio original o paga el vigente — se pueda
 * aplicar después sin haber perdido el dato.
 */
export declare const TemporadaSchema: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
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
export declare const EstadoPagoSchema: z.ZodEnum<{
    pendiente: "pendiente";
    pagada: "pagada";
    fallida: "fallida";
    expirada: "expirada";
}>;
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
export declare const EstadoEntregableSchema: z.ZodEnum<{
    pendiente: "pendiente";
    generando: "generando";
    entregado: "entregado";
    fallido: "fallido";
}>;
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
export declare function prometeVacantes(tier: Tier): boolean;
/** ¿Este cobro promete strings booleanos de búsqueda? */
export declare function prometeStrings(tier: Tier): boolean;
/** ¿Este cobro promete un CV redactado? */
export declare function prometeCv(tier: Tier): boolean;
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
export declare function prometeEjecutivo(tier: Tier): boolean;
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
export declare function exigeTerminos(tier: Tier): boolean;
/**
 * El reconocimiento que **toda compra de pago** registra antes de cobrar.
 *
 * Vive en `contracts` y no en la web porque la versión aceptada se persiste en
 * `compras.terminos_version`: si el texto cambiara y no quedara constancia de
 * cuál se aceptó, lo guardado dejaría de probar nada. Cambiar este texto o
 * `TEXTO_TERMINOS_CV` obliga a subir `VERSION_TERMINOS_COMPRA`.
 */
export declare const TEXTO_TERMINOS_COMPRA: string;
/**
 * Cláusula que se **suma** para los tiers que redactan un CV (`prometeCv`). Antes
 * era el texto único (`VERSION_TERMINOS_CV`, retirado): el CV es el único
 * entregable que la persona presenta como suyo ante un tercero, así que lo que
 * edite después tiene consecuencias para ella.
 */
export declare const TEXTO_TERMINOS_CV: string;
/**
 * El texto completo que se muestra y se acepta en el checkout de `tier`: el
 * reconocimiento de compra, y la cláusula del CV cuando el tier lo redacta.
 *
 * Una sola casilla y un solo número de versión. La versión N mapea de forma
 * determinista a "qué se mostró" a partir del tier, así que reconstruirlo más
 * tarde no necesita guardar el texto entero.
 */
export declare function textoTerminos(tier: Tier): string;
/**
 * Sube cada vez que cambie `TEXTO_TERMINOS_COMPRA` o `TEXTO_TERMINOS_CV`. Se
 * guarda en `compras.terminos_version`.
 *
 * Empieza en 2: la versión 1 fue el texto solo-CV de preproducción
 * (`VERSION_TERMINOS_CV`, retirado el 2026-08-29), y ninguna compra de un tercero
 * la registró.
 */
export declare const VERSION_TERMINOS_COMPRA = 2;
/**
 * ¿Hay algo que generar por esta compra?
 *
 * `gratis` no se cobra y no entrega nada por esta vía, así que su entregable no
 * llega nunca a `generando` y el panel no debe quedarse esperándolo.
 */
export declare function prometeEntregable(tier: Tier): boolean;
/**
 * Tabla `compras`.
 *
 * `precio_centavos_mxn` guarda **el monto realmente cobrado en esta
 * transacción**, en centavos y como entero — nunca flotantes para dinero. Se
 * desvía del nombre `precio_mxn` del documento fuente §3 justamente para que la
 * unidad quede explícita en el nombre y nadie multiplique por 100 dos veces.
 */
export declare const CompraSchema: z.ZodObject<{
    id: z.ZodUUID;
    perfil_id: z.ZodNullable<z.ZodUUID>;
    email_cliente: z.ZodEmail;
    tier: z.ZodEnum<{
        gratis: "gratis";
        tier_1: "tier_1";
        tier_2: "tier_2";
        tier_1_2: "tier_1_2";
        tier_3: "tier_3";
        reinicio_perfil: "reinicio_perfil";
        cv_redactado: "cv_redactado";
        cv_bilingue: "cv_bilingue";
    }>;
    precio_centavos_mxn: z.ZodNumber;
    temporada: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    estado_pago: z.ZodEnum<{
        pendiente: "pendiente";
        pagada: "pagada";
        fallida: "fallida";
        expirada: "expirada";
    }>;
    procesador: z.ZodEnum<{
        paypal: "paypal";
        openpay: "openpay";
    }>;
    transaccion_id: z.ZodNullable<z.ZodString>;
    procesador_ref: z.ZodNullable<z.ZodString>;
    guia_path: z.ZodNullable<z.ZodString>;
    perfil_ejecutivo_path: z.ZodNullable<z.ZodString>;
    retro_path: z.ZodNullable<z.ZodString>;
    entregable_estado: z.ZodEnum<{
        pendiente: "pendiente";
        generando: "generando";
        entregado: "entregado";
        fallido: "fallido";
    }>;
    entregable_motivo_fallo: z.ZodNullable<z.ZodString>;
    entregable_intentos: z.ZodNumber;
    terminos_aceptados_at: z.ZodNullable<z.ZodISODateTime>;
    terminos_version: z.ZodNullable<z.ZodNumber>;
    recibo_enviado_at: z.ZodNullable<z.ZodISODateTime>;
    created_at: z.ZodISODateTime;
    updated_at: z.ZodISODateTime;
}, z.core.$strip>;
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
export declare const CompraServidaSchema: z.ZodObject<{
    id: z.ZodUUID;
    procesador: z.ZodEnum<{
        paypal: "paypal";
        openpay: "openpay";
    }>;
    tier: z.ZodEnum<{
        gratis: "gratis";
        tier_1: "tier_1";
        tier_2: "tier_2";
        tier_1_2: "tier_1_2";
        tier_3: "tier_3";
        reinicio_perfil: "reinicio_perfil";
        cv_redactado: "cv_redactado";
        cv_bilingue: "cv_bilingue";
    }>;
    temporada: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    estado_pago: z.ZodEnum<{
        pendiente: "pendiente";
        pagada: "pagada";
        fallida: "fallida";
        expirada: "expirada";
    }>;
    entregable_estado: z.ZodEnum<{
        pendiente: "pendiente";
        generando: "generando";
        entregado: "entregado";
        fallido: "fallido";
    }>;
    perfil_id: z.ZodNullable<z.ZodUUID>;
    email_cliente: z.ZodEmail;
    precio_centavos_mxn: z.ZodNumber;
    transaccion_id: z.ZodNullable<z.ZodString>;
    entregable_motivo_fallo: z.ZodNullable<z.ZodString>;
    entregable_intentos: z.ZodNumber;
    terminos_aceptados_at: z.ZodNullable<z.ZodISODateTime>;
    terminos_version: z.ZodNullable<z.ZodNumber>;
    recibo_enviado_at: z.ZodNullable<z.ZodISODateTime>;
    created_at: z.ZodISODateTime;
    updated_at: z.ZodISODateTime;
    guia_url_firmada: z.ZodNullable<z.ZodURL>;
    perfil_ejecutivo_url_firmada: z.ZodNullable<z.ZodURL>;
    retro_url_firmada: z.ZodNullable<z.ZodURL>;
}, z.core.$strip>;
export type CompraServida = z.infer<typeof CompraServidaSchema>;
/**
 * `POST /checkout/:tier`.
 *
 * El precio no viaja en la petición: lo resuelve el Worker a partir del tier y
 * de la temporada vigente. Aceptar un precio del cliente sería manipulable.
 */
export declare const CheckoutRequestSchema: z.ZodObject<{
    perfil_id: z.ZodUUID;
    terminos_version: z.ZodNumber;
}, z.core.$strip>;
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;
export declare const CheckoutResponseSchema: z.ZodObject<{
    compra_id: z.ZodUUID;
    checkout_url: z.ZodURL;
}, z.core.$strip>;
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
export declare const PrecioTierSchema: z.ZodObject<{
    tier: z.ZodEnum<{
        gratis: "gratis";
        tier_1: "tier_1";
        tier_2: "tier_2";
        tier_1_2: "tier_1_2";
        tier_3: "tier_3";
        reinicio_perfil: "reinicio_perfil";
        cv_redactado: "cv_redactado";
        cv_bilingue: "cv_bilingue";
    }>;
    centavos: z.ZodNumber;
    concepto: z.ZodString;
}, z.core.$strip>;
export type PrecioTier = z.infer<typeof PrecioTierSchema>;
export declare const PreciosResponseSchema: z.ZodObject<{
    temporada: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    tiers: z.ZodArray<z.ZodObject<{
        tier: z.ZodEnum<{
            gratis: "gratis";
            tier_1: "tier_1";
            tier_2: "tier_2";
            tier_1_2: "tier_1_2";
            tier_3: "tier_3";
            reinicio_perfil: "reinicio_perfil";
            cv_redactado: "cv_redactado";
            cv_bilingue: "cv_bilingue";
        }>;
        centavos: z.ZodNumber;
        concepto: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PreciosResponse = z.infer<typeof PreciosResponseSchema>;
