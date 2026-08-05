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
export const ProcesadorPagoSchema = z.enum(['paypal', 'openpay']);
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
export const PayPalWebhookPayloadSchema = z.object({
  /** Id del evento (`WH-...`). Clave de idempotencia. */
  id: z.string().min(1),
  /** `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, etc. */
  event_type: z.string().min(1),
  create_time: z.string(),
  resource_type: z.string().optional(),
  // `looseObject` conserva las claves no declaradas: si PayPal añade campos, se
  // guardan en vez de descartarse silenciosamente.
  resource: z.looseObject({
    /** Id de la captura. Es lo que va a `compras.transaccion_id`. */
    id: z.string().min(1),
    /** `COMPLETED`, `PENDING`, `DECLINED`, `REFUNDED`… */
    status: z.string().optional(),
    // PayPal manda el monto como cadena ("79.00"), no como número.
    amount: z
      .looseObject({
        currency_code: z.string().optional(),
        value: z.string().optional(),
      })
      .optional(),
  }),
});
export type PayPalWebhookPayload = z.infer<typeof PayPalWebhookPayloadSchema>;

/**
 * Tabla `webhook_events`. Log de todo lo recibido del procesador.
 *
 * `procesado_at` nulo significa recibido pero aún no aplicado — permite
 * distinguir "nunca llegó" de "llegó y falló al procesarse", que se resuelven
 * de formas distintas.
 */
export const WebhookEventSchema = z.object({
  id: z.uuid(),
  procesador: ProcesadorPagoSchema,
  /** Id del evento tal como lo asigna el procesador. Único. */
  evento_externo_id: z.string().min(1),
  payload: z.unknown(),
  recibido_at: z.iso.datetime(),
  procesado_at: z.iso.datetime().nullable(),
});
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
