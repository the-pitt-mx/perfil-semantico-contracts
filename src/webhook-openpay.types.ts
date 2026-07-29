import { z } from 'zod';

/**
 * Webhook de Openpay e idempotencia.
 *
 * El algoritmo que exige el documento fuente §4:
 *   1. Insertar el evento en `webhook_events` con `openpay_event_id` único,
 *      usando ON CONFLICT DO NOTHING.
 *   2. Si no se afectó ninguna fila, ya se procesó: responder 200 sin
 *      reprocesar.
 *   3. Si es nuevo, actualizar `compras.estado_pago` en la misma transacción y
 *      solo entonces disparar Resend.
 *
 * El orden importa: disparar el correo antes de cerrar la transacción abre la
 * puerta a confirmaciones duplicadas cuando Openpay reintenta.
 */

/**
 * Payload entrante de Openpay.
 *
 * Deliberadamente permisivo en `transaction`: Openpay puede añadir campos, y
 * un esquema estricto rechazaría eventos válidos. Se valida lo que se usa; el
 * resto se conserva íntegro en `webhook_events.payload` para poder depurar.
 */
export const OpenpayWebhookPayloadSchema = z.object({
  /** Id único del evento. Es la clave de idempotencia. */
  id: z.string().min(1),
  /** Tipo de evento: `charge.succeeded`, `charge.failed`, etc. */
  type: z.string().min(1),
  event_date: z.string(),
  transaction: z
    .object({
      id: z.string().min(1),
      status: z.string().min(1),
      amount: z.number().optional(),
      currency: z.string().optional(),
    })
    .passthrough(),
});
export type OpenpayWebhookPayload = z.infer<typeof OpenpayWebhookPayloadSchema>;

/**
 * Tabla `webhook_events`. Log de todo lo recibido de Openpay.
 *
 * `procesado_at` nulo significa recibido pero aún no aplicado — permite
 * distinguir "nunca llegó" de "llegó y falló al procesarse", que se resuelven
 * de formas distintas.
 */
export const WebhookEventSchema = z.object({
  id: z.string().uuid(),
  openpay_event_id: z.string().min(1),
  payload: z.unknown(),
  procesado_at: z.string().datetime().nullable(),
});
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
