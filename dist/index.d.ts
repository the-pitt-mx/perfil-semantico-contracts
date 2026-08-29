import { z } from 'zod';
export * from './perfil.schema.js';
export * from './compra.schema.js';
export * from './vacante.schema.js';
export * from './cv-redactado.schema.js';
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
export declare const PerfilCompletoResponseSchema: z.ZodObject<{
    perfil: z.ZodObject<{
        id: z.ZodUUID;
        created_at: z.ZodISODateTime;
        contenido: z.ZodNullable<z.ZodObject<{
            datos_contacto: z.ZodObject<{
                nombre_completo: z.ZodString;
                titulo_objetivo: z.ZodString;
                email: z.ZodEmail;
                telefono: z.ZodNullable<z.ZodString>;
                linkedin: z.ZodNullable<z.ZodString>;
                ubicacion: z.ZodNullable<z.ZodString>;
                formacion_academica: z.ZodNullable<z.ZodString>;
                idiomas: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>;
            sintesis: z.ZodString;
            habilidades_clave: z.ZodArray<z.ZodObject<{
                nombre: z.ZodString;
                descripcion: z.ZodString;
            }, z.core.$strip>>;
            posiciones_alternativas: z.ZodArray<z.ZodObject<{
                titulo: z.ZodString;
                tipo_fit: z.ZodEnum<{
                    directo: "directo";
                    transferible: "transferible";
                    ambicioso: "ambicioso";
                }>;
            }, z.core.$strip>>;
            nota_estrategica: z.ZodString;
        }, z.core.$strip>>;
        cliente_id: z.ZodUUID;
        estado: z.ZodEnum<{
            generando: "generando";
            fallido: "fallido";
            esperando_correo: "esperando_correo";
            activo: "activo";
            reemplazado: "reemplazado";
        }>;
        cv_id: z.ZodUUID;
        version: z.ZodNumber;
        motivo_fallo: z.ZodNullable<z.ZodString>;
        pdf_url_firmada: z.ZodNullable<z.ZodURL>;
        idioma_cv: z.ZodNullable<z.ZodEnum<{
            es: "es";
            en: "en";
        }>>;
        cv_original_disponible: z.ZodBoolean;
        cv_original_url_firmada: z.ZodNullable<z.ZodURL>;
    }, z.core.$strip>;
    compras: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
    vacantes: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        compra_id: z.ZodUUID;
        puesto: z.ZodString;
        empresa: z.ZodString;
        fit_pct: z.ZodNumber;
        url_vacante: z.ZodURL;
        motivo: z.ZodString;
        snapshot_fecha: z.ZodISODate;
    }, z.core.$strip>>;
    strings_booleanos: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        compra_id: z.ZodUUID;
        etiqueta: z.ZodString;
        contenido: z.ZodString;
    }, z.core.$strip>>;
    cvs_redactados: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        compra_id: z.ZodUUID;
        idioma: z.ZodEnum<{
            es: "es";
            en: "en";
        }>;
        contenido: z.ZodObject<{
            nombre_completo: z.ZodString;
            titulo_objetivo: z.ZodString;
            contacto: z.ZodString;
            resumen: z.ZodString;
            experiencia: z.ZodArray<z.ZodObject<{
                puesto: z.ZodString;
                empresa: z.ZodString;
                periodo: z.ZodString;
                logros: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            habilidades: z.ZodArray<z.ZodString>;
            formacion: z.ZodArray<z.ZodString>;
            idiomas: z.ZodArray<z.ZodString>;
            recomendaciones_pendientes: z.ZodArray<z.ZodObject<{
                recomendacion: z.ZodString;
                donde: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        created_at: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PerfilCompletoResponse = z.infer<typeof PerfilCompletoResponseSchema>;
