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
export declare const OpenpayWebhookPayloadSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    event_date: z.ZodString;
    transaction: z.ZodObject<{
        id: z.ZodString;
        status: z.ZodString;
        amount: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>;
}, z.core.$strip>;
export type OpenpayWebhookPayload = z.infer<typeof OpenpayWebhookPayloadSchema>;
/**
 * Tabla `webhook_events`. Log de todo lo recibido de Openpay.
 *
 * `procesado_at` nulo significa recibido pero aún no aplicado — permite
 * distinguir "nunca llegó" de "llegó y falló al procesarse", que se resuelven
 * de formas distintas.
 */
export declare const WebhookEventSchema: z.ZodObject<{
    id: z.ZodUUID;
    openpay_event_id: z.ZodString;
    payload: z.ZodUnknown;
    procesado_at: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strip>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
