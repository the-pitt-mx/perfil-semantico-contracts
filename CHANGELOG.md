# Changelog

Este paquete se consume como dependencia git por tag. **Cada release debe llevar
un tag `vX.Y.Z`**; sin tag, `api` y `web` no pueden fijar una versión.

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado: [SemVer](https://semver.org/lang/es/) — un cambio breaking sin subir
major rompe silenciosamente al otro repo (ADR-001 §9).

## [0.9.0] — 2026-08-01

### Añadido (breaking)
- **`Compra` gana `entregable_estado`, `entregable_motivo_fallo` y
  `entregable_intentos`** (migración 0016). Un perfil sabía decir que falló
  —`estado` y `motivo_fallo`—; una compra no, y es al revés de como debería ser,
  porque ahí el dinero ya cambió de manos.

  Hasta ahora el estado del entregable se **infería**, y las dos inferencias que
  existían estaban mal: el panel tendría que mirar `guia_path` (funciona por
  accidente, porque la guía se escribe al final), y el vigilante preguntaba "¿hay
  al menos una vacante?" — pero una entrega correcta puede traer **cero**, que es
  la regla del umbral de fit, no un fallo (§B.12). Y cuando la generación reventaba
  de verdad no quedaba rastro en la base: el panel giraba para siempre sobre un
  cobro ya hecho.

  Es breaking porque los tres campos son requeridos: un consumidor en 0.8.0 que
  reciba esta forma no la valida.

- **`StringBooleano` gana `etiqueta`.** Tier 2 entrega varias cadenas y sin nombre
  son borrones casi idénticos: el entregable que promete autonomía acababa
  produciendo la duda de cuál pegar.

- **`EstadoEntregable`**, `prometeVacantes()`, `prometeStrings()` y
  `prometeEntregable()`. Las tres funciones vivían —o iban a vivir— en `api`, pero
  tienen tres consumidores que deben coincidir: el generador, el vigilante y el
  panel, que necesita saber si esperar algo antes de enseñar "estamos buscando tus
  vacantes". Si divergieran, el panel prometería lo que nadie va a generar.

- **`PreciosResponse` y `PrecioTier`** para `GET /precios`. Solo la forma: este
  paquete es público y los importes viven en el Worker, que es quien conoce la
  temporada vigente.

## [0.8.0] — 2026-07-31

### Cambiado (breaking)
- **`VacanteRecomendada` pierde `cover_letter_path`, y `VacanteServida`
  desaparece.** Tier 1 dejó de entregar cinco cartas y ahora entrega **una guía
  para redactar tu cover letter** (ADR-001 §A.22).

  La ruta colgaba de cada vacante. Una guía única no pertenece a una vacante:
  repetir la misma ruta en las cinco filas, o colgarla de una elegida al azar,
  miente sobre la forma del dato — y quien lea el esquema dentro de seis meses
  concluirá que hay cinco archivos.

  `VacanteServida` existía solo para traducir esa ruta a una URL firmada. Sin
  ruta, lo que se guarda y lo que se sirve son idénticos, y dos nombres para la
  misma forma solo invitan a preguntarse cuál toca usar. La distinción no se
  perdió: se mudó a `CompraServida`.

- **`PerfilCompletoResponse.compras` pasa a ser `CompraServida[]`** y
  **`.vacantes` a `VacanteRecomendada[]`**.

### Añadido
- **`VacanteRecomendada.motivo`** — por qué esa vacante le queda, en una frase
  dirigida al candidato. El puntuador de fit ya lo produce y hasta ahora se
  descartaba.

  Un porcentaje solo, en el entregable que se cobra, se lee como arbitrario. Lo
  que sostiene el producto es que el número sea honesto, y los motivos reales lo
  demuestran porque incluyen el pero: *"…aunque el sector manufactura sería nuevo
  para ti"*. Tope de 400 caracteres, generoso a propósito: debe ser una frase
  —eso lo pide el prompt— y el límite solo evita que un desbordamiento del modelo
  reviente la maquetación, sin convertir un motivo largo en una entrega fallida
  para alguien que ya pagó.

- **`Compra.guia_path`** — ruta en Storage de la guía. Nula mientras no se ha
  generado, y también en los tiers que no la incluyen.
- **`CompraServida`** — la compra tal como se le sirve al navegador, con
  `guia_url_firmada` en lugar de la ruta. Hereda el papel que tenía
  `VacanteServida`: que una ruta cruda no se filtre al cliente —no le sirve de
  nada, el bucket es privado— y que una URL que caduca en minutos no se persista.

### Nota para quien migre
`api` debe dejar de leer `cover_letter_path` en la consulta del panel y empezar a
firmar `guia_path`. La columna equivalente en la base la mueve la migración 0014
de `infra`, que además tiene que hacer que el trigger de purga limpie la ruta
nueva: `compras` sobrevive a la supresión del perfil como registro fiscal, y una
guía que sobreviva es un dato personal que alguien pidió borrar.

## [0.7.0] — 2026-07-30

### Cambiado (breaking)
- **`PerfilSemantico.contenido` pasa a ser nullable.** La base permite
  `contenido_json` nulo mientras el perfil no está `activo` —lo impone con un
  CHECK— así que el esquema estaba mintiendo: un consumidor que asumiera contenido
  siempre presente reventaba justo al leer un perfil `generando`, es decir en la
  pantalla de espera, que es la primera que ve el candidato.

### Añadido
- **`PerfilSemantico.motivo_fallo`** — por qué falló, redactado para mostrárselo
  al candidato tal cual. Solo viene con `estado: 'fallido'`, y la base lo impone
  con un CHECK para que un motivo olvidado no sobreviva a un reintento exitoso.

  Existe porque la verificación de CV puede rechazar un archivo que no es un
  currículum, y ese motivo no tenía dónde vivir: el candidato veía `fallido` a
  secas. Como reintentar cuesta un tier de pago, dejarlo adivinar es cobrarle por
  un error que detectamos y no le explicamos. Va en el panel y no solo en el
  correo, porque el correo puede no llegar.

## [0.6.0] — 2026-07-30

### Añadido
- **`LecturaCvSchema`** — envoltura de la salida del modelo:
  `{ es_cv, motivo, contenido }`.

  Existe porque `ContenidoPerfilSchema` **obliga** a producir un perfil: exige al
  menos una habilidad y una posición. Sin envoltura, un PDF que no es un CV
  llevaría al modelo a inventarlas para satisfacer el esquema, justo en contra de
  la regla de no inventar. Ahora tiene una salida honesta.

  También sale más barato: con `contenido: null` no se generan los tokens de
  salida, que son ~2/3 del costo. **Rechazar una subida basura cuesta menos que
  procesarla** (~$0.49 MXN contra ~$1.52).

  La correlación entre campos (`es_cv: true` ⇒ `contenido` presente) no se expresa
  en el esquema porque la salida estructurada de Claude no admite validaciones
  condicionales; se comprueba en el Worker.

## [0.5.0] — 2026-07-30

Cambio de procesador de pagos: **PayPal** en lugar de Openpay.

### Cambiado (breaking)
- `Compra.openpay_transaction_id` → **`Compra.transaccion_id`**, y se añade
  **`Compra.procesador`**. Los nombres son genéricos a propósito: ya se cambió de
  procesador una vez, y no hay razón para pagar una migración de renombrado
  completa la próxima. Añadir un procesador ahora es aditivo.
- `webhook-openpay.types.ts` → **`webhook-pago.types.ts`**.
- `OpenpayWebhookPayloadSchema` → **`PayPalWebhookPayloadSchema`**, con la forma
  real de PayPal: `event_type` en vez de `type`, `create_time` en vez de
  `event_date`, y `resource` en vez de `transaction`. El monto llega como
  **cadena** (`"79.00"`), no como número.
- `WebhookEvent.openpay_event_id` → **`evento_externo_id`**, y se añaden
  `procesador` y `recibido_at`.

### Añadido
- `ProcesadorPagoSchema` — hoy solo `'paypal'`.

### Trampa que el esquema documenta
En PayPal, `id` identifica el **evento** (`WH-...`) y `resource.id` la **captura**.
El primero es la clave de idempotencia y va a `webhook_events.evento_externo_id`;
el segundo va a `compras.transaccion_id`. Confundirlos rompe la idempotencia y la
conciliación a la vez, así que hay una prueba dedicada a que sean campos
distintos.

## [0.4.0] — 2026-07-29

Migración a Zod 4.

### Cambiado (breaking)
- **`zod` pasa de `^3.23` a `^4.0`.** Un consumidor que resuelva Zod 3 tendrá dos
  copias del paquete, y los esquemas de aquí dejarán de ser reconocidos por
  helpers tipados contra la otra: las comprobaciones de tipo fallan entre copias
  distintas. Los consumidores deben alinearse en Zod 4.

  El detonante fue concreto: `zodOutputFormat` del SDK de Anthropic —el que
  convierte un esquema en el formato de salida estructurada de Claude— está
  tipado contra Zod 4 y rechaza un esquema de Zod 3. Sin esta migración, la
  generación de perfiles no podría reutilizar `ContenidoPerfilSchema` y habría
  que mantener un JSON Schema a mano en paralelo, que es exactamente la
  divergencia que este paquete existe para evitar.

- Idiomas actualizados en vez de alias deprecados: `z.uuid()`, `z.email()`,
  `z.url()`, `z.iso.datetime()`, `z.iso.date()`, y `z.looseObject()` en lugar de
  `.passthrough()` para el payload de Openpay.

### Añadido
- `./package.json` en el campo `exports`. Varias herramientas lo leen por esa
  subruta y sin él fallan con `ERR_PACKAGE_PATH_NOT_EXPORTED`.

### Nota
- Zod 4 trae `z.toJSONSchema()` nativo, así que el JSON Schema que pedía el
  ADR-001 §3 ya no necesita dependencia extra ni mantenimiento manual.

## [No publicado]

### Documentación
- `PerfilCompletoResponse` pasa a hablar del **panel** del cliente, no del
  "repositorio": es el término que se usa de cara al candidato y en la URL
  (ADR-001 §A.10). Se recuerda ahí también que qué mostrar se resuelve con
  `tieneAcceso()`, nunca comparando `compra.tier` a mano.
- Se precisa qué registra `Compra.recibo_enviado_at`: el correo de confirmación de
  compra de Resend, que incluye el recibo de Openpay. **No es el CFDI**, que se
  emite manualmente y no se rastrea aquí. Sin cambio de tipos, así que no lleva
  versión propia — viaja con el próximo release.

## [0.3.0] — 2026-07-29

Retención fiscal de compras. Decisión de negocio: hay obligación legal de
conservar la información de consumo del cliente **al menos un año**, con lo
mínimo para identificar la transacción.

### Añadido
- `Compra.email_cliente` — copia del correo al momento de la compra, no una
  referencia. Es el identificador fiscal de la transacción y lo que permite que
  la compra sobreviva a la supresión del perfil.
- `Compra.recibo_enviado_at` — marca de tiempo en vez de booleano: da el sí/no
  que pide el requisito (nulo = no enviado) y además el cuándo, que es lo que
  hace falta si un cliente reclama no haberlo recibido.

### Cambiado (breaking)
- `Compra.perfil_id` pasa a ser nullable. `null` significa que el perfil fue
  suprimido y la fila solo se conserva como registro fiscal. Un cliente nunca
  recibe una fila así: RLS resuelve la propiedad a través del perfil, así que una
  compra huérfana es invisible con cualquier JWT de usuario.

## [0.2.0] — 2026-07-29

Regla de checkout confirmada por Peter: el upsell de Tier 2 se puede aceptar
antes de pagar (un solo cobro) o después de la confirmación de compra (cobro
separado por el incremento).

### Añadido
- `tier_1_2` en `Tier` — Tier 1 y Tier 2 cobrados en un mismo checkout. Un
  checkout produce una sola transacción de Openpay y `openpay_transaction_id` es
  único, así que dos filas de compra no pueden compartirla; el paquete se guarda
  como un valor de tier propio, igual que ya hacía `reinicio_perfil`.
- `TIERS_OTORGADOS` y `tieneAcceso()` — qué desbloquea cada cobro. Está aquí y no
  en `api` o `web` porque es exactamente el dato que ambos interpretarían
  distinto: si `web` olvidara que `tier_1_2` otorga Tier 2, escondería contenido
  ya pagado.

### Cambiado (breaking)
- `Tier` tiene un valor más. Un `switch` exhaustivo sobre `Tier` en un consumidor
  dejaría de compilar. No hay consumidores todavía.

## [0.1.0] — 2026-07-29

Primera versión con esquemas. Fase 1 del ADR-001.

### Añadido
- `perfil.schema.ts` — `Cliente`, `Cv`, `ContenidoPerfil` (el `contenido_json`),
  `PerfilSemantico`, `TipoFit`, `PosicionAlternativa`, `LEYENDA_FITS`, y los
  contratos de `POST /cv` y `POST /access/resend`.
- `compra.schema.ts` — `Tier`, `Temporada`, `EstadoPago`, `Compra` y el contrato
  de `POST /checkout/:tier`.
- `vacante.schema.ts` — `VacanteRecomendada`, `StringBooleano` y `VacanteServida`
  (la variante con URL firmada que se manda al navegador).
- `webhook-openpay.types.ts` — `OpenpayWebhookPayload` y `WebhookEvent`.
- `index.ts` — re-exporta todo y compone `PerfilCompletoResponse`.
- Zod como fuente única: los tipos TypeScript se derivan con `z.infer`, nunca se
  escriben a mano en paralelo.

### Notas de diseño
- `PosicionAlternativa` (gratis, sin empresa) y `VacanteRecomendada` (Tier 1/3,
  con empresa y enlace externo) son tipos distintos a propósito. Los documentos
  de negocio llaman "posiciones recomendadas" a ambas cosas.
- `LEYENDA_FITS` es texto fijo exportado como constante, no un campo por perfil:
  guardarlo en cada `contenido_json` lo volvería incorregible en los perfiles ya
  emitidos.
- Los campos de Storage se llaman `*_path` y guardan la ruta en el bucket. Las
  URLs firmadas solo aparecen en los tipos de respuesta (`*_url_firmada`), que
  son distintos de los tipos de tabla para que no se filtre una ruta cruda al
  cliente ni se persista una URL caducable.

### Pendiente
- Generación de JSON Schema. El ADR-001 §3 la pide, pero hoy no tiene consumidor:
  `api` y `web` son ambos TypeScript. Se añadirá en Fase 3, donde sí hará falta
  para la salida estructurada de Claude.
