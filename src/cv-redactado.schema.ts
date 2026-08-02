import { z } from 'zod';

/**
 * El CV redactado (tier `cv_redactado`).
 *
 * ## Por qué es estructura y no un bloque de texto
 *
 * De este mismo dato salen cuatro cosas: la hoja maquetada del panel, el
 * `text/html` que se copia al portapapeles, el `text/plain` de respaldo y el PDF
 * opcional. Con un blob de markdown habría que reconstruir la estructura cuatro
 * veces, y las cuatro divergirían. Mismo criterio que `ContenidoPerfil`.
 *
 * ## Lo que este esquema NO puede garantizar
 *
 * Que el contenido sea cierto. La forma se valida aquí; que no haya un puesto
 * inventado o un equipo de doce personas que nadie dirigió lo comprueba el
 * verificador de `api`, cotejando cada cifra y cada nombre propio contra el CV
 * original y el perfil. Esa comprobación es lo que sostiene la promesa que se le
 * hace al candidato al cobrarle.
 */

/**
 * Un puesto del historial.
 *
 * `empresa`, `puesto` y las fechas **se transcriben**, no se interpretan: son los
 * hechos del CV original y son justo lo que no se puede tocar. Lo que se reescribe
 * son los `logros`.
 */
export const ExperienciaSchema = z.object({
  puesto: z.string().min(1),
  empresa: z.string().min(1),
  /**
   * Tal como aparece en el original ("2019 — 2023", "Ene 2020 - actual").
   *
   * Cadena y no fechas tipadas a propósito: los CVs traen formatos incompatibles
   * entre sí, y normalizarlos obligaría a inferir meses que no están escritos —
   * que es exactamente la clase de invención que este producto no admite.
   */
  periodo: z.string().min(1),
  /**
   * Qué hizo ahí, en viñetas y reescrito para el puesto objetivo.
   *
   * Aquí es donde vive el valor del tier: mismo hecho, dicho con el vocabulario
   * del sector y ordenado por relevancia. Y aquí es donde se cuela una cifra
   * inventada, así que es lo que el verificador mira con más cuidado.
   *
   * **Puede venir vacío, y es deliberado.** Los puestos antiguos que no tienen que
   * ver con el objetivo se dejan solo con puesto, empresa y fechas (Peter,
   * 2026-08-01): ocupan una línea, sostienen la continuidad del historial y no le
   * roban atención a lo que sí importa. Exigir al menos una viñeta obligaría a
   * redactar relleno para trabajos irrelevantes.
   */
  logros: z.array(z.string().min(1)),
});
export type Experiencia = z.infer<typeof ExperienciaSchema>;

/**
 * En qué idioma está escrito un CV.
 *
 * Dos y no una lista abierta: el mercado que atiende esto es México, y lo que
 * aparece de verdad es español o inglés. Un enum cerrado obliga a decidir
 * explícitamente el día que aparezca un tercero, en vez de dejar entrar cualquier
 * cadena.
 */
export const IdiomaCvSchema = z.enum(['es', 'en']);
export type IdiomaCv = z.infer<typeof IdiomaCvSchema>;

/**
 * Algo que el perfil recomendaba y que **no se pudo aplicar por falta de datos**.
 *
 * `nota_estrategica` casi siempre pide información que solo el candidato tiene —
 * "cuantifica el volumen de casos que gestionaste al mes"—. Ese número no está en
 * su CV, no está en su perfil, y no puede estar en ningún sitio nuestro: si lo
 * escribiéramos, lo estaríamos inventando, que es justo lo que este producto no
 * hace.
 *
 * Así que la recomendación la aplica el candidato y la redacción la aplicamos
 * nosotros. Cuando llega sin aplicar, se dice — con la misma lógica con la que se
 * entregan menos de cinco vacantes y se explica por qué. Que quede a la vista lo
 * que no inventamos es la prueba visible de la promesa por la que se paga.
 *
 * **No forma parte del texto que se copia al portapapeles.** Va pegado al CV en
 * el panel, no dentro de él: pegado en Word acabaría enviado a un reclutador.
 */
export const RecomendacionPendienteSchema = z.object({
  /** Qué pedía el perfil, dicho como acción concreta para el candidato. */
  recomendacion: z.string().min(1),
  /** En qué punto del CV va, para que sepa dónde colocarlo. */
  donde: z.string().min(1),
});
export type RecomendacionPendiente = z.infer<typeof RecomendacionPendienteSchema>;

export const CvRedactadoSchema = z.object({
  nombre_completo: z.string().min(1),
  /** El puesto al que apunta este CV. Sale del fit directo del perfil. */
  titulo_objetivo: z.string().min(1),
  /** Contacto en una línea, ya compuesto: correo, teléfono, ubicación, LinkedIn. */
  contacto: z.string().min(1),
  /** El párrafo de arriba. Es lo único que un reclutador lee seguro. */
  resumen: z.string().min(1),
  experiencia: z.array(ExperienciaSchema),
  /** Nombres de habilidad, para la banda de palabras clave. Sin descripciones: aquí no caben. */
  habilidades: z.array(z.string().min(1)).min(1),
  formacion: z.array(z.string().min(1)),
  /** Vacío si el original no menciona ninguno. Nunca se rellena por simetría visual. */
  idiomas: z.array(z.string().min(1)),
  /**
   * Lo que el perfil recomendaba y el CV todavía no trae. Vacío cuando el
   * candidato ya lo aplicó antes de comprar, que es el camino que se le propone.
   */
  recomendaciones_pendientes: z.array(RecomendacionPendienteSchema),
});
export type CvRedactado = z.infer<typeof CvRedactadoSchema>;

/**
 * Tabla `cvs_redactados`. Uno por compra.
 *
 * Tabla propia y no una columna en `compras` —como sí lo es `guia_path`— porque
 * esto es dato personal denso y `compras` sobrevive a la supresión como registro
 * fiscal. Mismo patrón que `vacantes_recomendadas` y `strings_booleanos`: la
 * supresión los borra y la compra permanece.
 */
export const CvRedactadoFilaSchema = z.object({
  id: z.uuid(),
  compra_id: z.uuid(),
  idioma: IdiomaCvSchema,
  contenido: CvRedactadoSchema,
  created_at: z.iso.datetime(),
});
export type CvRedactadoFila = z.infer<typeof CvRedactadoFilaSchema>;

/**
 * El texto que el candidato acepta antes de comprar (Peter, 2026-08-01).
 *
 * Vive en `contracts` y no en la web porque **la versión aceptada se persiste en
 * la compra**: si el texto cambiara y no quedara constancia de cuál se aceptó, lo
 * guardado dejaría de probar nada. Cambiar este texto obliga a subir
 * `VERSION_TERMINOS_CV`.
 */
export const TEXTO_TERMINOS_CV =
  'Este texto se construye solo con lo que dice tu CV y tu perfil semántico. No ' +
  'añadimos experiencia, títulos ni habilidades que tú no hayas declarado — esa es ' +
  'la razón por la que sirve. Lo que edites a partir de aquí es tuyo: si se infla o ' +
  'se inventa información, las consecuencias son para ti y Fanware no responde por ' +
  'ellas.';

/** Sube cada vez que cambie `TEXTO_TERMINOS_CV`. Se guarda en `compras.terminos_version`. */
export const VERSION_TERMINOS_CV = 1;
