import { z } from 'zod';
/**
 * Webhook del procesador de pagos e idempotencia.
 *
 * El procesador es **PayPal** (decisión del 2026-07-30, sustituye a Openpay).
 * Los nombres de campo de la tabla son genéricos a propósito —`transaccion_id`,
 * `evento_externo_id`, más una columna `procesador`— porque ya se cambió de
 * procesador una vez y no hay razón para pagar la migración completa la próxima.
 * Lo que sí es específico de cada procesador es el **parser del payload**: cada
 * uno manda una forma distinta.
 *
 * El algoritmo de idempotencia no cambia con el procesador (Implicaciones
 * Técnicas §4):
 *   1. Insertar el evento en `webhook_events` con `evento_externo_id` único,
 *      usando ON CONFLICT DO NOTHING.
 *   2. Si no se afectó ninguna fila, ya se procesó: responder 200 sin
 *      reprocesar.
 *   3. Si es nuevo, actualizar `compras.estado_pago` en la MISMA transacción y
 *      solo entonces disparar Resend.
 *
 * El orden importa: disparar el correo antes de cerrar la transacción abre la
 * puerta a confirmaciones duplicadas cuando el procesador reintenta.
 */
/**
 * Procesadores soportados.
 *
 * **Esta lista tiene que ir a la par del enum `procesador_pago` de la base.** Si
 * la base admite un valor que aquí no está, el panel entero deja de validar: no
 * falla la compra nueva, falla `GET /perfil` para esa persona, que es mucho peor
 * porque se lleva por delante lo que ya tenía.
 *
 * Ocurrió el 2026-08-05 al entrar OpenPay: la migración 0022 añadió el valor a la
 * base y esto se quedó en `['paypal']`. La primera compra con tarjeta dejó el
 * panel de ese candidato en 500. Desde entonces la suite de `infra` concilia
 * también este enum, además de los tres que ya vigilaba.
 */
export declare const ProcesadorPagoSchema: z.ZodEnum<{
    paypal: "paypal";
    openpay: "openpay";
}>;
export type ProcesadorPago = z.infer<typeof ProcesadorPagoSchema>;
/**
 * Payload entrante de PayPal.
 *
 * Deliberadamente permisivo en `resource`: PayPal añade campos según el tipo de
 * evento, y un esquema estricto rechazaría notificaciones válidas. Se valida lo
 * que se usa; el resto se conserva íntegro en `webhook_events.payload`.
 *
 * **`id` y `resource.id` son cosas distintas y confundirlas rompe el sistema.**
 * `id` identifica el **evento** (formato `WH-...`) y es la clave de idempotencia.
 * `resource.id` identifica la **captura del pago**, y es lo que se guarda en
 * `compras.transaccion_id` para conciliar contra PayPal.
 */
export declare const PayPalWebhookPayloadSchema: z.ZodObject<{
    id: z.ZodString;
    event_type: z.ZodString;
    create_time: z.ZodString;
    resource_type: z.ZodOptional<z.ZodString>;
    resource: z.ZodObject<{
        id: z.ZodString;
        status: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodObject<{
            currency_code: z.ZodOptional<z.ZodString>;
            value: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>;
    }, z.core.$loose>;
}, z.core.$strip>;
export type PayPalWebhookPayload = z.infer<typeof PayPalWebhookPayloadSchema>;
/**
 * Tabla `webhook_events`. Log de todo lo recibido del procesador.
 *
 * `procesado_at` nulo significa recibido pero aún no aplicado — permite
 * distinguir "nunca llegó" de "llegó y falló al procesarse", que se resuelven
 * de formas distintas.
 */
export declare const WebhookEventSchema: z.ZodObject<{
    id: z.ZodUUID;
    procesador: z.ZodEnum<{
        paypal: "paypal";
        openpay: "openpay";
    }>;
    evento_externo_id: z.ZodString;
    payload: z.ZodUnknown;
    recibido_at: z.ZodISODateTime;
    procesado_at: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strip>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
