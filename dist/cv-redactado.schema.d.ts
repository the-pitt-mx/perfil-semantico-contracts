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
export declare const ExperienciaSchema: z.ZodObject<{
    puesto: z.ZodString;
    empresa: z.ZodString;
    periodo: z.ZodString;
    logros: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type Experiencia = z.infer<typeof ExperienciaSchema>;
/**
 * En qué idioma está escrito un CV.
 *
 * Dos y no una lista abierta: el mercado que atiende esto es México, y lo que
 * aparece de verdad es español o inglés. Un enum cerrado obliga a decidir
 * explícitamente el día que aparezca un tercero, en vez de dejar entrar cualquier
 * cadena.
 */
export declare const IdiomaCvSchema: z.ZodEnum<{
    es: "es";
    en: "en";
}>;
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
export declare const RecomendacionPendienteSchema: z.ZodObject<{
    recomendacion: z.ZodString;
    donde: z.ZodString;
}, z.core.$strip>;
export type RecomendacionPendiente = z.infer<typeof RecomendacionPendienteSchema>;
export declare const CvRedactadoSchema: z.ZodObject<{
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
export type CvRedactado = z.infer<typeof CvRedactadoSchema>;
/**
 * Tabla `cvs_redactados`. Uno por compra.
 *
 * Tabla propia y no una columna en `compras` —como sí lo es `guia_path`— porque
 * esto es dato personal denso y `compras` sobrevive a la supresión como registro
 * fiscal. Mismo patrón que `vacantes_recomendadas` y `strings_booleanos`: la
 * supresión los borra y la compra permanece.
 */
export declare const CvRedactadoFilaSchema: z.ZodObject<{
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
}, z.core.$strip>;
export type CvRedactadoFila = z.infer<typeof CvRedactadoFilaSchema>;
