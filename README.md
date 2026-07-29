# perfil-semantico-contracts

Fuente única de verdad del "idioma" entre `perfil-semantico-api` y `perfil-semantico-web`:
tipos TypeScript y esquemas del perfil semántico, la compra y los eventos de webhook.

**Ningún otro repo puede redefinir estos tipos localmente.** Si `api` y `web` interpretan
"estado de compra" de formas distintas, el bug es silencioso y caro.

> **Estado: Fase 0 (ADR-001 §8).** Solo estructura de carpetas y configuración de build.
> No hay esquemas todavía.

## Prerequisitos de cuentas

Ninguno. Este repo no habla con ningún servicio externo.

## Distribución: dependencia git por tag

Decisión de arranque: se consume como dependencia git, no como paquete npm privado
(evita el costo de un scope privado en npmjs y la configuración de `.npmrc` con token
en los cuatro repos y en CI). Migrar a npm privado después es un cambio de una línea.

Para consumirlo desde `api` o `web`:

```bash
npm install "git+https://<host>/<org>/perfil-semantico-contracts.git#v0.1.0"
```

El `#v0.1.0` **no es opcional**: sin tag, npm instala la punta de la rama por defecto y
pierdes el versionado. El script `prepare` de este paquete compila `dist/` en el momento
de la instalación, que es lo que hace viable la dependencia git.

> Pendiente: el host y la organización de git aún no están decididos (no hay `gh` CLI
> instalado ni remoto configurado). Sustituir `<host>/<org>` cuando se resuelva.

## Publicar una versión

1. Actualizar `CHANGELOG.md`.
2. `npm version <patch|minor|major>`.
3. `git push --follow-tags`.
4. Actualizar la referencia `#vX.Y.Z` en `api` y `web`.

Un cambio breaking sin subir major rompe silenciosamente al otro repo (ADR-001 §9).

## Estructura

```
src/
  perfil.schema.ts          PerfilSemantico, versión, estado
  compra.schema.ts          Compra, EstadoPago, Tier, Temporada
  vacante.schema.ts         VacanteRecomendada, CoverLetter
  webhook-openpay.types.ts  Payload del webhook de Openpay
  index.ts                  re-exporta todo
```

## Comandos

```bash
npm install
npm run build
npm run typecheck
```

## Decisiones abiertas de Fase 1

- **Fuente de verdad de los esquemas.** El ADR pide "tipos TypeScript y JSON Schema".
  Mantener ambos a mano se desincroniza. Recomendación: definir con Zod y derivar tipos
  + JSON Schema de ahí.
- **Modelo de datos.** Los esquemas de este repo derivan de las 7 tablas descritas en
  *"Perfil Semántico — Implicaciones Técnicas"*. Ese documento **no está disponible**;
  Fase 1 está bloqueada hasta tenerlo.

## Referencia

`../ADR-001-arquitectura.md`
