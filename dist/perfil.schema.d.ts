import { z } from 'zod';
/**
 * Perfil semántico: el entregable del flujo gratis.
 *
 * Alcance del tier gratis (Modelo de Negocio §2):
 *   perfil semántico + habilidades clave + nombres alternativos de posición
 *   por tipo de fit, con su leyenda.
 *
 * Las vacantes reales en empresas concretas NO viven aquí — son Tier 1/3 y
 * están en `vacante.schema.ts` como `VacanteRecomendada`. Ver ADR-001 §B.10:
 * ambas cosas se llaman "posiciones recomendadas" en los documentos de negocio,
 * y confundirlas es exactamente el bug que este paquete existe para prevenir.
 */
/** Tabla `clientes`. Identidad mínima del candidato. */
export declare const ClienteSchema: z.ZodObject<{
    id: z.ZodUUID;
    email: z.ZodEmail;
    created_at: z.ZodISODateTime;
}, z.core.$strip>;
export type Cliente = z.infer<typeof ClienteSchema>;
/**
 * Tabla `cvs`. Archivo subido por el cliente, versionado.
 *
 * `archivo_path` es la ruta dentro del bucket privado `cv-originales`, no una
 * URL utilizable. El documento de Implicaciones Técnicas §9 exige URLs firmadas
 * con expiración corta: la URL se firma al servirla, nunca se persiste.
 */
export declare const CvSchema: z.ZodObject<{
    id: z.ZodUUID;
    cliente_id: z.ZodUUID;
    archivo_path: z.ZodString;
    hash: z.ZodString;
    uploaded_at: z.ZodISODateTime;
}, z.core.$strip>;
export type Cv = z.infer<typeof CvSchema>;
/** Encabezado del PDF. Los campos nulos se renderizan como "no proporcionado". */
export declare const DatosContactoSchema: z.ZodObject<{
    nombre_completo: z.ZodString;
    titulo_objetivo: z.ZodString;
    email: z.ZodEmail;
    telefono: z.ZodNullable<z.ZodString>;
    linkedin: z.ZodNullable<z.ZodString>;
    ubicacion: z.ZodNullable<z.ZodString>;
    formacion_academica: z.ZodNullable<z.ZodString>;
    idiomas: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type DatosContacto = z.infer<typeof DatosContactoSchema>;
/** Una fila del bloque "Habilidades clave". */
export declare const HabilidadClaveSchema: z.ZodObject<{
    nombre: z.ZodString;
    descripcion: z.ZodString;
}, z.core.$strip>;
export type HabilidadClave = z.infer<typeof HabilidadClaveSchema>;
/**
 * Los tres tipos de fit. Es el modelo mental reutilizable que el candidato se
 * lleva (Modelo de Negocio §1), así que sus etiquetas son producto, no detalle
 * de presentación.
 */
export declare const TipoFitSchema: z.ZodEnum<{
    directo: "directo";
    transferible: "transferible";
    ambicioso: "ambicioso";
}>;
export type TipoFit = z.infer<typeof TipoFitSchema>;
/**
 * Un nombre alternativo de posición. **No es una vacante**: no tiene empresa ni
 * enlace. Es "cómo se llama en el mercado lo que ya sabes hacer".
 */
export declare const PosicionAlternativaSchema: z.ZodObject<{
    titulo: z.ZodString;
    tipo_fit: z.ZodEnum<{
        directo: "directo";
        transferible: "transferible";
        ambicioso: "ambicioso";
    }>;
}, z.core.$strip>;
export type PosicionAlternativa = z.infer<typeof PosicionAlternativaSchema>;
/** Lo que se guarda en `perfiles_semanticos.contenido_json`. */
export declare const ContenidoPerfilSchema: z.ZodObject<{
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
}, z.core.$strip>;
export type ContenidoPerfil = z.infer<typeof ContenidoPerfilSchema>;
/**
 * Leyenda de los tipos de fit. **Texto fijo, no personalizable por candidato.**
 *
 * Vive aquí y no dentro de `contenido_json` a propósito: duplicarla en cada
 * perfil generado la volvería imposible de corregir en los perfiles ya
 * emitidos. `web` y la plantilla del PDF la leen de esta única fuente.
 */
export declare const LEYENDA_FITS: Record<TipoFit, {
    etiqueta: string;
    resumen: string;
    explicacion: string;
}>;
/**
 * Lo que devuelve el modelo al leer el archivo subido.
 *
 * **Existe porque el esquema de `ContenidoPerfil` obliga a producir un perfil.**
 * Sin esta envoltura, un PDF que no es un CV —un recibo, un contrato, una foto
 * escaneada— llevaría al modelo a inventar habilidades y puestos para satisfacer
 * los mínimos del esquema, en contra de la regla de no inventar. Aquí tiene una
 * salida honesta.
 *
 * También es más barato: al devolver `contenido: null` no genera el perfil, y los
 * tokens de salida son ~2/3 del costo por llamada. Rechazar una subida basura
 * cuesta menos que procesarla.
 *
 * La correlación entre campos (`es_cv: true` ⇒ `contenido` presente) no se
 * expresa aquí porque la salida estructurada de Claude no admite validaciones
 * condicionales: se comprueba en el Worker al recibir la respuesta.
 */
export declare const LecturaCvSchema: z.ZodObject<{
    es_cv: z.ZodBoolean;
    motivo: z.ZodNullable<z.ZodString>;
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
}, z.core.$strip>;
export type LecturaCv = z.infer<typeof LecturaCvSchema>;
/**
 * Estado del perfil.
 *
 * `reemplazado` es el único que fija el documento fuente §3: al reiniciar
 * perfil el anterior no se borra, se archiva, para no romper las compras
 * históricas que apuntan a él. Los otros tres se añadieron en Fase 1 porque la
 * generación es asíncrona y puede fallar (ver ADR-001 §B.1).
 *
 * `esperando_correo` es anterior a todos ellos y existe por dinero: el perfil se
 * crea al subir el CV, pero **no se encola nada** hasta que el candidato abre el
 * enlace de acceso. Antes se generaba de inmediato, así que un correo inventado
 * costaba ~$1.85 MXN igual que uno real, sin tope ni rate limit. Es un estado y
 * no un booleano porque el cron de recuperación reencola lo que lleve rato en
 * `generando`: dejarlo ahí se habría generado solo (migración 0021).
 */
export declare const EstadoPerfilSchema: z.ZodEnum<{
    generando: "generando";
    fallido: "fallido";
    esperando_correo: "esperando_correo";
    activo: "activo";
    reemplazado: "reemplazado";
}>;
export type EstadoPerfil = z.infer<typeof EstadoPerfilSchema>;
export declare const PerfilSemanticoSchema: z.ZodObject<{
    id: z.ZodUUID;
    cliente_id: z.ZodUUID;
    cv_id: z.ZodUUID;
    version: z.ZodNumber;
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
    pdf_path: z.ZodNullable<z.ZodString>;
    estado: z.ZodEnum<{
        generando: "generando";
        fallido: "fallido";
        esperando_correo: "esperando_correo";
        activo: "activo";
        reemplazado: "reemplazado";
    }>;
    motivo_fallo: z.ZodNullable<z.ZodString>;
    created_at: z.ZodISODateTime;
}, z.core.$strip>;
export type PerfilSemantico = z.infer<typeof PerfilSemanticoSchema>;
/**
 * `POST /cv`. El archivo viaja como multipart aparte; aquí van los metadatos.
 *
 * `cliente_id` presente distingue un **reinicio de perfil legítimo** de un
 * abuso del flujo gratis — el documento fuente §7 lo exige explícitamente para
 * el rate limiting.
 */
export declare const UploadCvRequestSchema: z.ZodObject<{
    email: z.ZodEmail;
    cliente_id: z.ZodNullable<z.ZodUUID>;
}, z.core.$strip>;
export type UploadCvRequest = z.infer<typeof UploadCvRequestSchema>;
/** Respuesta de `POST /cv`. La generación es asíncrona: nace en `generando`. */
export declare const PerfilSemanticoResponseSchema: z.ZodObject<{
    perfil_id: z.ZodUUID;
    cliente_id: z.ZodUUID;
    estado: z.ZodEnum<{
        generando: "generando";
        fallido: "fallido";
        esperando_correo: "esperando_correo";
        activo: "activo";
        reemplazado: "reemplazado";
    }>;
}, z.core.$strip>;
export type PerfilSemanticoResponse = z.infer<typeof PerfilSemanticoResponseSchema>;
/** `POST /access/resend` — reenvía el magic link al email registrado. */
export declare const ResendAccessRequestSchema: z.ZodObject<{
    email: z.ZodEmail;
}, z.core.$strip>;
export type ResendAccessRequest = z.infer<typeof ResendAccessRequestSchema>;
