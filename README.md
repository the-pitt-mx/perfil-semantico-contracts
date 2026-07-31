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

### Este repositorio es público a propósito

`infra`, `api` y `web` son privados. **Este es público**, y es lo que hace que
`npm install` funcione sin credenciales en tu máquina, en GitHub Actions y en el build de
Cloudflare — tres sitios donde, si fuera privado, habría que configurar un token para
clonar un segundo repo privado durante la instalación.

Lo que expone es la forma de los datos: nombres de tipos y de campos. **Nunca debe entrar
aquí** una llave, una URL de servicio, un precio, un prompt de Claude ni lógica de
negocio. Si algo de eso hace falta compartirlo entre repos, va en otro sitio.

Para consumirlo desde `api` o `web`:

```bash
npm install "git+https://github.com/the-pitt-mx/perfil-semantico-contracts.git#v0.1.0"
```

El `#v0.1.0` **no es opcional**: sin tag, npm instala la punta de la rama por defecto y
pierdes el versionado. El script `prepare` de este paquete compila `dist/` en el momento
de la instalación, que es lo que hace viable la dependencia git.

### Riesgo conocido: npm bloquea scripts de instalación

`dist/` no está en el repositorio — se genera al instalar, vía `prepare`. npm 11 empezó a
bloquear scripts de ciclo de vida por defecto y avisa al instalar este paquete:

```
npm warn allow-scripts @fanware/perfil-semantico-contracts@0.1.0 (prepare: npm run build)
```

Verificado el 2026-07-29 con npm 11.16: **el `prepare` sí corre** para dependencias git y
`dist/` queda construido. Pero si una versión futura de npm lo bloquea de verdad, el
paquete se instalará vacío y el error en `api` o `web` será confuso ("no se encuentra el
módulo"), no obvio.

Si eso pasa, las salidas por orden de preferencia son: aprobar el script en el consumidor
(`npm approve-scripts`), publicar el paquete ya compilado en un registro, o commitear
`dist/`. La última funciona siempre pero ensucia los diffs.

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
  compra.schema.ts          Compra, CompraServida, EstadoPago, Tier, Temporada
  vacante.schema.ts         VacanteRecomendada, StringBooleano
  webhook-pago.types.ts     Payload del webhook del procesador de pagos
  index.ts                  re-exporta todo y compone PerfilCompletoResponse
```

## Comandos

```bash
npm install
```

```bash
npm test
```

`npm test` compila primero y luego corre `test/schemas.test.mjs`: 22 casos, incluidos los
que **deben** rechazarse. Un esquema que acepta todo no valida nada, así que la mitad de la
suite son datos inválidos.

## Decisiones abiertas de Fase 1

- **Fuente de verdad de los esquemas.** El ADR pide "tipos TypeScript y JSON Schema".
  Mantener ambos a mano se desincroniza. Recomendación: definir con Zod y derivar tipos
  + JSON Schema de ahí.
- **Modelo de datos.** Los esquemas de este repo derivan de las 7 tablas descritas en
  *"Perfil Semántico — Implicaciones Técnicas"*. Ese documento **no está disponible**;
  Fase 1 está bloqueada hasta tenerlo.

## Referencia

`../ADR-001-arquitectura.md`
