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

// ---------------------------------------------------------------------------
// Identidad
// ---------------------------------------------------------------------------

/** Tabla `clientes`. Identidad mínima del candidato. */
export const ClienteSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  created_at: z.string().datetime(),
});
export type Cliente = z.infer<typeof ClienteSchema>;

/**
 * Tabla `cvs`. Archivo subido por el cliente, versionado.
 *
 * `archivo_path` es la ruta dentro del bucket privado `cv-originales`, no una
 * URL utilizable. El documento de Implicaciones Técnicas §9 exige URLs firmadas
 * con expiración corta: la URL se firma al servirla, nunca se persiste.
 */
export const CvSchema = z.object({
  id: z.string().uuid(),
  cliente_id: z.string().uuid(),
  archivo_path: z.string().min(1),
  /** Hash del archivo, para detectar resubidas idénticas. */
  hash: z.string().min(1),
  uploaded_at: z.string().datetime(),
});
export type Cv = z.infer<typeof CvSchema>;

// ---------------------------------------------------------------------------
// Contenido del perfil (`perfiles_semanticos.contenido_json`)
// ---------------------------------------------------------------------------

/** Encabezado del PDF. Los campos nulos se renderizan como "no proporcionado". */
export const DatosContactoSchema = z.object({
  nombre_completo: z.string().min(1),
  /** Título o rol objetivo, no el puesto actual. */
  titulo_objetivo: z.string().min(1),
  email: z.string().email(),
  telefono: z.string().nullable(),
  linkedin: z.string().nullable(),
  ubicacion: z.string().nullable(),
  formacion_academica: z.string().nullable(),
  idiomas: z.string().nullable(),
});
export type DatosContacto = z.infer<typeof DatosContactoSchema>;

/** Una fila del bloque "Habilidades clave". */
export const HabilidadClaveSchema = z.object({
  nombre: z.string().min(1),
  /** Cómo la ejecuta en concreto, no una definición genérica. */
  descripcion: z.string().min(1),
});
export type HabilidadClave = z.infer<typeof HabilidadClaveSchema>;

/**
 * Los tres tipos de fit. Es el modelo mental reutilizable que el candidato se
 * lleva (Modelo de Negocio §1), así que sus etiquetas son producto, no detalle
 * de presentación.
 */
export const TipoFitSchema = z.enum(['directo', 'transferible', 'ambicioso']);
export type TipoFit = z.infer<typeof TipoFitSchema>;

/**
 * Un nombre alternativo de posición. **No es una vacante**: no tiene empresa ni
 * enlace. Es "cómo se llama en el mercado lo que ya sabes hacer".
 */
export const PosicionAlternativaSchema = z.object({
  titulo: z.string().min(1),
  tipo_fit: TipoFitSchema,
});
export type PosicionAlternativa = z.infer<typeof PosicionAlternativaSchema>;

/** Lo que se guarda en `perfiles_semanticos.contenido_json`. */
export const ContenidoPerfilSchema = z.object({
  datos_contacto: DatosContactoSchema,
  /** Síntesis de 3-5 líneas: el valor real más allá de las tareas del CV. */
  sintesis: z.string().min(1),
  habilidades_clave: z.array(HabilidadClaveSchema).min(1),
  posiciones_alternativas: z.array(PosicionAlternativaSchema).min(1),
  /** Coaching puntual: qué cuantificar o mejorar antes de postularse. */
  nota_estrategica: z.string().min(1),
});
export type ContenidoPerfil = z.infer<typeof ContenidoPerfilSchema>;

/**
 * Leyenda de los tipos de fit. **Texto fijo, no personalizable por candidato.**
 *
 * Vive aquí y no dentro de `contenido_json` a propósito: duplicarla en cada
 * perfil generado la volvería imposible de corregir en los perfiles ya
 * emitidos. `web` y la plantilla del PDF la leen de esta única fuente.
 */
export const LEYENDA_FITS: Record<
  TipoFit,
  { etiqueta: string; resumen: string; explicacion: string }
> = {
  directo: {
    etiqueta: 'Fit directo',
    resumen:
      'Mismo trabajo, otro nombre. Ya tienes esta experiencia ejecutada, sin brecha de conocimiento ni de nivel.',
    explicacion:
      'Posiciones donde ya tienes la experiencia exacta; en tu empresa actual el puesto solo tiene un nombre distinto o menos "de mercado".',
  },
  transferible: {
    etiqueta: 'Fit por competencia transferible',
    resumen:
      'Misma habilidad, otro contexto. Ya la tienes; solo necesitas reposicionar cómo la cuentas, no adquirirla.',
    explicacion:
      'La habilidad de fondo es la misma, pero el título o el foco del rol requiere que reposiciones cómo lo cuentas.',
  },
  ambicioso: {
    etiqueta: 'Fit ambicioso',
    resumen:
      'Mismo trabajo, mayor escala. Es tu siguiente escalón jerárquico; conviene desarrollar la narrativa que hoy no está evidenciada en tu CV.',
    explicacion:
      'El siguiente escalón jerárquico. Aquí sí hay una brecha real: tendrías que argumentar que, aunque nunca has tenido ese título exacto, el tamaño de los resultados que ya generaste es evidencia de que puedes operar a ese nivel.',
  },
};

// ---------------------------------------------------------------------------
// Tabla `perfiles_semanticos`
// ---------------------------------------------------------------------------

/**
 * Estado del perfil.
 *
 * `reemplazado` es el único que fija el documento fuente §3: al reiniciar
 * perfil el anterior no se borra, se archiva, para no romper las compras
 * históricas que apuntan a él. Los otros tres se añadieron en Fase 1 porque la
 * generación es asíncrona y puede fallar (ver ADR-001 §B.1).
 */
export const EstadoPerfilSchema = z.enum([
  'generando',
  'activo',
  'reemplazado',
  'fallido',
]);
export type EstadoPerfil = z.infer<typeof EstadoPerfilSchema>;

export const PerfilSemanticoSchema = z.object({
  id: z.string().uuid(),
  cliente_id: z.string().uuid(),
  cv_id: z.string().uuid(),
  /** Incrementa con cada reinicio de perfil. Empieza en 1. */
  version: z.number().int().positive(),
  contenido: ContenidoPerfilSchema,
  /** Ruta en el bucket privado `perfiles-pdf`. Se firma al servir. */
  pdf_path: z.string().nullable(),
  estado: EstadoPerfilSchema,
  created_at: z.string().datetime(),
});
export type PerfilSemantico = z.infer<typeof PerfilSemanticoSchema>;

// ---------------------------------------------------------------------------
// Contratos de API (ADR-001 §5)
// ---------------------------------------------------------------------------

/**
 * `POST /cv`. El archivo viaja como multipart aparte; aquí van los metadatos.
 *
 * `cliente_id` presente distingue un **reinicio de perfil legítimo** de un
 * abuso del flujo gratis — el documento fuente §7 lo exige explícitamente para
 * el rate limiting.
 */
export const UploadCvRequestSchema = z.object({
  email: z.string().email(),
  cliente_id: z.string().uuid().nullable(),
});
export type UploadCvRequest = z.infer<typeof UploadCvRequestSchema>;

/** Respuesta de `POST /cv`. La generación es asíncrona: nace en `generando`. */
export const PerfilSemanticoResponseSchema = z.object({
  perfil_id: z.string().uuid(),
  cliente_id: z.string().uuid(),
  estado: EstadoPerfilSchema,
});
export type PerfilSemanticoResponse = z.infer<
  typeof PerfilSemanticoResponseSchema
>;

/** `POST /access/resend` — reenvía el magic link al email registrado. */
export const ResendAccessRequestSchema = z.object({
  email: z.string().email(),
});
export type ResendAccessRequest = z.infer<typeof ResendAccessRequestSchema>;
