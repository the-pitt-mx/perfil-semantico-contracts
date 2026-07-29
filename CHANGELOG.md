# Changelog

Este paquete se consume como dependencia git por tag. **Cada release debe llevar
un tag `vX.Y.Z`**; sin tag, `api` y `web` no pueden fijar una versión.

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado: [SemVer](https://semver.org/lang/es/) — un cambio breaking sin subir
major rompe silenciosamente al otro repo (ADR-001 §9).

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
