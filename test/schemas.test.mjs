import {
  ContenidoPerfilSchema,
  LecturaCvSchema,
  PerfilSemanticoSchema,
  CompraSchema,
  CompraServidaSchema,
  VacanteRecomendadaSchema,
  PayPalWebhookPayloadSchema,
  PerfilCompletoResponseSchema,
  LEYENDA_FITS,
  tieneAcceso,
  prometeVacantes,
  prometeStrings,
  prometeCv,
  prometeEntregable,
  exigeTerminos,
  CvRedactadoSchema,
  VERSION_TERMINOS_CV,
} from '../dist/index.js';

let ok = 0;
let fail = 0;

const acepta = (nombre, fn) => {
  try {
    fn();
    console.log(`  OK    ${nombre}`);
    ok++;
  } catch (e) {
    console.log(`  FALLA ${nombre}: ${e.message.split('\n')[0]}`);
    fail++;
  }
};

const rechaza = (nombre, fn) => {
  try {
    fn();
    console.log(`  FALLA ${nombre}: se aceptó y debía rechazarse`);
    fail++;
  } catch {
    console.log(`  OK    ${nombre}`);
    ok++;
  }
};

// ---------------------------------------------------------------------------
const contenido = {
  datos_contacto: {
    nombre_completo: 'Estefanía Altamira Padilla',
    titulo_objetivo: 'Coordinadora de Experiencia del Cliente',
    email: 'ejemplo@correo.com',
    telefono: '+52 55 1234 5678',
    linkedin: null,
    ubicacion: 'CDMX',
    formacion_academica: 'Lic. en Administración',
    idiomas: 'Español, Inglés',
  },
  sintesis: 'Ocho años operando procesos de atención en retail.',
  habilidades_clave: [
    { nombre: 'Gestión de escalaciones', descripcion: 'Resuelve casos de nivel 2 sin escalar a dirección.' },
  ],
  posiciones_alternativas: [
    { titulo: 'Customer Experience Lead', tipo_fit: 'directo' },
    { titulo: 'Service Design Specialist', tipo_fit: 'transferible' },
    { titulo: 'Gerente de Operaciones CX', tipo_fit: 'ambicioso' },
  ],
  nota_estrategica: 'Cuantifica el volumen de casos que gestionaste al mes.',
};

const compraBase = {
  id: '44444444-4444-4444-8444-444444444444',
  perfil_id: '11111111-1111-4111-8111-111111111111',
  email_cliente: 'cliente@correo.com',
  procesador: 'paypal',
  tier: 'tier_2',
  precio_centavos_mxn: 2900,
  temporada: 1,
  estado_pago: 'pendiente',
  transaccion_id: null,
  guia_path: null,
  entregable_estado: 'pendiente',
  entregable_motivo_fallo: null,
  entregable_intentos: 0,
  terminos_aceptados_at: null,
  terminos_version: null,
  recibo_enviado_at: null,
  created_at: '2026-07-29T12:00:00.000Z',
  updated_at: '2026-07-29T12:00:00.000Z',
};

// ---------------------------------------------------------------------------
console.log('\nDatos válidos:');

acepta('ContenidoPerfil completo', () => ContenidoPerfilSchema.parse(contenido));

const perfilBase = {
  id: '11111111-1111-4111-8111-111111111111',
  cliente_id: '22222222-2222-4222-8222-222222222222',
  cv_id: '33333333-3333-4333-8333-333333333333',
  version: 1,
  contenido,
  pdf_path: null,
  estado: 'generando',
  motivo_fallo: null,
  created_at: '2026-07-29T12:00:00.000Z',
};

acepta('PerfilSemantico en generando, sin PDF todavía', () =>
  PerfilSemanticoSchema.parse(perfilBase));

acepta('PerfilSemantico generando todavía sin contenido', () =>
  // La base permite contenido_json nulo mientras no esté activo. Un consumidor
  // que asuma que siempre viene revienta justo en la pantalla de espera.
  PerfilSemanticoSchema.parse({ ...perfilBase, contenido: null }));

acepta('PerfilSemantico fallido con el motivo que verá el candidato', () =>
  PerfilSemanticoSchema.parse({
    ...perfilBase,
    contenido: null,
    estado: 'fallido',
    motivo_fallo: 'El archivo parece un recibo de pago, no un currículum.',
  }));

acepta('Compra pendiente, sin transacción ni recibo', () => CompraSchema.parse(compraBase));

acepta('Compra huérfana: perfil suprimido, registro fiscal conservado', () =>
  CompraSchema.parse({
    ...compraBase,
    perfil_id: null,
    estado_pago: 'pagada',
    transaccion_id: '8XY12345AB678901C',
    recibo_enviado_at: '2026-07-29T12:05:00.000Z',
  }));

acepta('VacanteRecomendada con enlace externo', () =>
  VacanteRecomendadaSchema.parse({
    id: '55555555-5555-4555-8555-555555555555',
    compra_id: compraBase.id,
    puesto: 'CX Manager',
    empresa: 'Acme',
    fit_pct: 87,
    url_vacante: 'https://mx.computrabajo.com/vacante/123',
    motivo: 'Tu experiencia coordinando turnos responde a lo que piden en piso de venta.',
    snapshot_fecha: '2026-07-29',
  }));

// La guía cuelga de la compra, no de la vacante (ADR-001 §A.22).
acepta('Compra con la guía todavía sin generar', () =>
  CompraSchema.parse({ ...compraBase, guia_path: null }));

acepta('Compra con la ruta de su guía', () =>
  CompraSchema.parse({
    ...compraBase,
    guia_path: '44444444-4444-4444-8444-444444444444/guia-abc.pdf',
  }));

acepta('CompraServida trae la guía ya firmada', () => {
  const { guia_path, ...resto } = compraBase;
  const c = CompraServidaSchema.parse({
    ...resto,
    guia_url_firmada: 'https://storage.ejemplo.com/guia.pdf?token=abc',
  });
  // La ruta cruda no llega al navegador: el bucket es privado y no le sirve.
  if ('guia_path' in c) throw new Error('la ruta se filtró al tipo servido');
});

// El pago y la entrega fallan por separado: esto es lo que permite nombrar el
// caso que más importa, pagada y sin entregar.
acepta('Compra pagada con el entregable todavía generando', () =>
  CompraSchema.parse({
    ...compraBase,
    estado_pago: 'pagada',
    transaccion_id: '8XY12345AB678901C',
    entregable_estado: 'generando',
    entregable_intentos: 1,
  }));

acepta('Compra pagada cuyo entregable falló, con motivo para el panel', () =>
  CompraSchema.parse({
    ...compraBase,
    estado_pago: 'pagada',
    transaccion_id: '8XY12345AB678901C',
    entregable_estado: 'fallido',
    entregable_motivo_fallo:
      'No pudimos completar la búsqueda de vacantes. Ya lo estamos revisando y te escribimos en cuanto esté.',
    entregable_intentos: 2,
  }));

// Cero vacantes es una entrega legítima, no un fallo: manda el umbral de fit
// (ADR-001 §B.12). Si el estado no lo dijera, habría que inferirlo contando
// vacantes y una entrega impecable se leería como rota.
acepta('Entregado sin ninguna vacante: la entrega correcta puede venir vacía', () =>
  PerfilCompletoResponseSchema.parse({
    perfil: { ...perfilBase, pdf_url_firmada: null, idioma_cv: 'es', cv_original_disponible: true, cv_original_url_firmada: null },
    compras: [
      (() => {
        const { guia_path, ...resto } = compraBase;
        return {
          ...resto,
          tier: 'tier_1',
          estado_pago: 'pagada',
          transaccion_id: '8XY12345AB678901C',
          entregable_estado: 'entregado',
          entregable_intentos: 1,
          guia_url_firmada: 'https://storage.ejemplo.com/guia.pdf?token=abc',
        };
      })(),
    ],
    vacantes: [],
    strings_booleanos: [],
    cvs_redactados: [],
  }));

// Las tres reglas se resuelven con TIERS_OTORGADOS, nunca comparando el tier a
// mano: reinicio_perfil es el cobro más caro y es justo el que se olvida.
acepta('reinicio_perfil promete vacantes y strings, como tier_1_2', () => {
  for (const tier of ['tier_1', 'tier_1_2', 'tier_3', 'reinicio_perfil']) {
    if (!prometeVacantes(tier)) throw new Error(`${tier} debía prometer vacantes`);
  }
  for (const tier of ['tier_2', 'tier_1_2', 'reinicio_perfil']) {
    if (!prometeStrings(tier)) throw new Error(`${tier} debía prometer strings`);
  }
  if (prometeVacantes('tier_2')) throw new Error('tier_2 no entrega vacantes');
  if (prometeStrings('tier_1')) throw new Error('tier_1 suelto no entrega strings');
  if (prometeEntregable('gratis')) throw new Error('gratis no entrega nada por esta vía');
});

const cvRedactado = {
  nombre_completo: 'Estefanía Altamira Padilla',
  titulo_objetivo: 'Customer Experience Lead',
  contacto: 'ejemplo@correo.com · +52 55 1234 5678 · CDMX',
  resumen: 'Ocho años operando procesos de atención en retail.',
  experiencia: [
    {
      puesto: 'Coordinadora de Atención',
      empresa: 'Tienda Ejemplo',
      periodo: '2019 — 2023',
      logros: ['Gestión de escalaciones de nivel 2 sin llegar a dirección.'],
    },
  ],
  habilidades: ['Gestión de escalaciones'],
  formacion: ['Lic. en Administración'],
  idiomas: ['Español', 'Inglés'],
  recomendaciones_pendientes: [],
};

acepta('CvRedactado con todo aplicado y sin pendientes', () =>
  CvRedactadoSchema.parse(cvRedactado));

// El caso que obliga a que exista el campo: la nota estratégica pide un dato que
// solo el candidato tiene, y si no lo aportó no se inventa — se dice.
acepta('CvRedactado que declara lo que no se pudo aplicar', () => {
  const cv = CvRedactadoSchema.parse({
    ...cvRedactado,
    recomendaciones_pendientes: [
      {
        recomendacion: 'Cuantifica el volumen de casos que gestionaste al mes.',
        donde: 'En tus logros de Coordinadora de Atención.',
      },
    ],
  });
  if (cv.recomendaciones_pendientes.length !== 1) throw new Error('se perdió el pendiente');
});

acepta('CvRedactado sin experiencia todavía es válido', () =>
  // Un CV de alguien que empieza. Exigir al menos un puesto obligaría al modelo a
  // inventarse uno para pasar la validación, que es el fallo peor posible aquí.
  CvRedactadoSchema.parse({ ...cvRedactado, experiencia: [], formacion: [], idiomas: [] }));

// Un puesto antiguo sin relación con el objetivo se deja solo con puesto, empresa
// y fechas: sostiene la continuidad del historial sin robarle atención a lo que
// importa. Exigir una viñeta obligaría a redactar relleno.
acepta('un puesto antiguo puede quedarse sin viñetas', () =>
  CvRedactadoSchema.parse({
    ...cvRedactado,
    experiencia: [
      ...cvRedactado.experiencia,
      { puesto: 'Cajera', empresa: 'Otro Comercio', periodo: '2015 — 2017', logros: [] },
    ],
  }));

acepta('cv_redactado se otorga a sí mismo y no lo da ningún otro tier', () => {
  if (!prometeCv('cv_redactado')) throw new Error('cv_redactado debía prometer el CV');
  if (!prometeEntregable('cv_redactado')) throw new Error('debía contar como entregable');
  // reinicio_perfil es el cobro más caro y otorga Tier 1 y 2, pero NO el CV: si
  // algún día lo incluyera, es una decisión de negocio, no un descuido de código.
  for (const tier of ['tier_1', 'tier_2', 'tier_1_2', 'tier_3', 'reinicio_perfil', 'gratis']) {
    if (prometeCv(tier)) throw new Error(`${tier} no debía prometer CV redactado`);
  }
  // Y no arrastra vacantes ni strings: se vende suelto desde el perfil gratuito.
  if (prometeVacantes('cv_redactado')) throw new Error('el CV no entrega vacantes');
  if (prometeStrings('cv_redactado')) throw new Error('el CV no entrega strings');
});

acepta('solo el CV redactado exige aceptar términos', () => {
  if (!exigeTerminos('cv_redactado')) throw new Error('el CV redactado sí los exige');
  for (const tier of ['tier_1', 'tier_2', 'tier_1_2', 'tier_3', 'reinicio_perfil']) {
    if (exigeTerminos(tier)) throw new Error(`${tier} no presenta nada a un tercero`);
  }
});

acepta('la compra guarda qué versión de los términos se aceptó', () => {
  // Sin la versión, la fecha no prueba nada: si el texto cambiara, lo aceptado
  // dejaría de ser lo que hoy se muestra.
  const c = CompraSchema.parse({
    ...compraBase,
    tier: 'cv_redactado',
    precio_centavos_mxn: 29_900,
    terminos_aceptados_at: '2026-08-01T12:00:00.000Z',
    terminos_version: VERSION_TERMINOS_CV,
  });
  if (c.terminos_version !== VERSION_TERMINOS_CV) throw new Error('se perdió la versión');
});

acepta('El webhook conserva campos que PayPal añada', () => {
  const r = PayPalWebhookPayloadSchema.parse({
    id: 'WH-1AB23456CD789012E-3FG45678HI901234J',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    create_time: '2026-07-29T12:00:00Z',
    resource_type: 'capture',
    resource: {
      id: '8XY12345AB678901C',
      status: 'COMPLETED',
      amount: { currency_code: 'MXN', value: '79.00' },
      campo_nuevo: 'x',
    },
  });
  if (r.resource.campo_nuevo !== 'x') throw new Error('se perdió el campo extra');
});

acepta('El id del evento y el de la captura son campos distintos', () => {
  // Confundirlos rompe la idempotencia y la conciliación a la vez: el evento va
  // a webhook_events.evento_externo_id y la captura a compras.transaccion_id.
  const r = PayPalWebhookPayloadSchema.parse({
    id: 'WH-EVENTO',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    create_time: '2026-07-29T12:00:00Z',
    resource: { id: 'CAPTURA', status: 'COMPLETED' },
  });
  if (r.id === r.resource.id) throw new Error('deberían ser distintos');
});

acepta('PerfilCompletoResponse con hub vacío', () =>
  PerfilCompletoResponseSchema.parse({
    perfil: {
      id: '11111111-1111-4111-8111-111111111111',
      cliente_id: '22222222-2222-4222-8222-222222222222',
      cv_id: '33333333-3333-4333-8333-333333333333',
      version: 1,
      contenido,
      pdf_url_firmada: 'https://x.supabase.co/storage/v1/object/sign/a?token=b',
      // Un CV ingerido antes de la migración 0017 no trae idioma. El panel tiene
      // que saber caer a la oferta genérica en vez de asumir español.
      idioma_cv: null,
      cv_original_disponible: true,
      cv_original_url_firmada: null,
      estado: 'activo',
      motivo_fallo: null,
      created_at: '2026-07-29T12:00:00.000Z',
    },
    compras: [],
    vacantes: [],
    strings_booleanos: [],
    cvs_redactados: [],
  }));

acepta('LecturaCv: el archivo sí era un CV', () =>
  LecturaCvSchema.parse({ es_cv: true, motivo: null, contenido }));

acepta('LecturaCv: el archivo no era un CV, sin perfil inventado', () =>
  LecturaCvSchema.parse({
    es_cv: false,
    motivo: 'El documento parece un recibo de pago, no un currículum.',
    contenido: null,
  }));

acepta('LEYENDA_FITS cubre los tres tipos de fit', () => {
  for (const t of ['directo', 'transferible', 'ambicioso']) {
    if (!LEYENDA_FITS[t]?.explicacion) throw new Error(`falta ${t}`);
  }
});

// ---------------------------------------------------------------------------
console.log('\nResolución de acceso — los dos flujos de checkout:');
const compra = (tier, estado_pago = 'pagada') => ({ tier, estado_pago });

acepta('Flujo 1: el paquete tier_1_2 otorga Tier 1 Y Tier 2', () => {
  const c = [compra('tier_1_2')];
  if (!tieneAcceso(c, 'tier_1')) throw new Error('debería dar Tier 1');
  if (!tieneAcceso(c, 'tier_2')) throw new Error('debería dar Tier 2');
});

acepta('Flujo 2: tier_1 suelto NO otorga Tier 2', () => {
  const c = [compra('tier_1')];
  if (!tieneAcceso(c, 'tier_1')) throw new Error('debería dar Tier 1');
  if (tieneAcceso(c, 'tier_2')) throw new Error('no debería dar Tier 2 todavía');
});

acepta('Flujo 2 completo: tier_1 y tier_2 comprados por separado', () => {
  const c = [compra('tier_1'), compra('tier_2')];
  if (!tieneAcceso(c, 'tier_1') || !tieneAcceso(c, 'tier_2')) throw new Error('debería dar ambos');
});

acepta('Una compra pendiente NO otorga acceso', () => {
  if (tieneAcceso([compra('tier_1_2', 'pendiente')], 'tier_1')) {
    throw new Error('un checkout abierto no puede desbloquear contenido');
  }
});

acepta('Ni expirada ni fallida otorgan acceso', () => {
  if (tieneAcceso([compra('tier_1', 'expirada')], 'tier_1')) throw new Error('expirada dio acceso');
  if (tieneAcceso([compra('tier_1', 'fallida')], 'tier_1')) throw new Error('fallida dio acceso');
});

acepta('reinicio_perfil otorga Tier 1 y Tier 2', () => {
  const c = [compra('reinicio_perfil')];
  if (!tieneAcceso(c, 'tier_1') || !tieneAcceso(c, 'tier_2')) throw new Error('debería dar ambos');
});

acepta('Sin compras, sin acceso', () => {
  if (tieneAcceso([], 'tier_1')) throw new Error('dio acceso sin compras');
});

// ---------------------------------------------------------------------------
console.log('\nDatos que DEBEN rechazarse:');

rechaza('fit_pct fuera de 0-100', () =>
  VacanteRecomendadaSchema.parse({
    id: '55555555-5555-4555-8555-555555555555',
    compra_id: compraBase.id,
    puesto: 'CX Manager', empresa: 'Acme', fit_pct: 140,
    url_vacante: 'https://ejemplo.com/v', motivo: 'Porque si.',
    snapshot_fecha: '2026-07-29',
  }));

rechaza('una vacante sin motivo: el porcentaje solo se lee como arbitrario', () =>
  VacanteRecomendadaSchema.parse({
    id: '55555555-5555-4555-8555-555555555555',
    compra_id: compraBase.id,
    puesto: 'CX Manager', empresa: 'Acme', fit_pct: 87,
    url_vacante: 'https://ejemplo.com/v', motivo: '',
    snapshot_fecha: '2026-07-29',
  }));

rechaza('CompraServida con una URL de guía que no es URL', () => {
  const { guia_path, ...resto } = compraBase;
  return CompraServidaSchema.parse({ ...resto, guia_url_firmada: 'guia-abc.pdf' });
});

rechaza('un tipo_fit inventado', () =>
  ContenidoPerfilSchema.parse({
    ...contenido,
    posiciones_alternativas: [{ titulo: 'X', tipo_fit: 'lateral' }],
  }));

rechaza('temporada 4, que no existe', () =>
  CompraSchema.parse({ ...compraBase, temporada: 4 }));

rechaza('precio con decimales: debe ser centavos enteros', () =>
  CompraSchema.parse({ ...compraBase, precio_centavos_mxn: 79.5 }));

// `entregado` es del entregable y `pagada` del pago: cruzarlos deja pasar una
// compra que dice haber entregado sin decir si le cobraron.
rechaza('un estado de entregable que no existe', () =>
  CompraSchema.parse({ ...compraBase, entregable_estado: 'pagada' }));

rechaza('intentos negativos de generación', () =>
  CompraSchema.parse({ ...compraBase, entregable_intentos: -1 }));

rechaza('compra sin estado de entregable: volvería a inferirse de la guía', () => {
  const { entregable_estado, ...sinEstado } = compraBase;
  CompraSchema.parse(sinEstado);
});

rechaza('compra sin email_cliente: registro fiscal incompleto', () => {
  const { email_cliente, ...sinCorreo } = compraBase;
  return CompraSchema.parse(sinCorreo);
});

rechaza('perfil sin habilidades clave', () =>
  ContenidoPerfilSchema.parse({ ...contenido, habilidades_clave: [] }));

rechaza('perfil sin posiciones alternativas', () =>
  ContenidoPerfilSchema.parse({ ...contenido, posiciones_alternativas: [] }));

rechaza('LecturaCv sin el veredicto es_cv', () =>
  LecturaCvSchema.parse({ motivo: null, contenido }));

rechaza('LecturaCv con un contenido a medias', () =>
  LecturaCvSchema.parse({
    es_cv: true,
    motivo: null,
    contenido: { ...contenido, habilidades_clave: [] },
  }));

// ---------------------------------------------------------------------------
console.log(`\nResultado: ${ok} OK, ${fail} fallas`);
process.exit(fail === 0 ? 0 : 1);
