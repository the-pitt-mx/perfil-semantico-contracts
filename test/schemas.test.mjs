import {
  ContenidoPerfilSchema,
  LecturaCvSchema,
  PerfilSemanticoSchema,
  CompraSchema,
  VacanteRecomendadaSchema,
  PayPalWebhookPayloadSchema,
  PerfilCompletoResponseSchema,
  LEYENDA_FITS,
  tieneAcceso,
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
  recibo_enviado_at: null,
  created_at: '2026-07-29T12:00:00.000Z',
  updated_at: '2026-07-29T12:00:00.000Z',
};

// ---------------------------------------------------------------------------
console.log('\nDatos válidos:');

acepta('ContenidoPerfil completo', () => ContenidoPerfilSchema.parse(contenido));

acepta('PerfilSemantico en generando, sin PDF todavía', () =>
  PerfilSemanticoSchema.parse({
    id: '11111111-1111-4111-8111-111111111111',
    cliente_id: '22222222-2222-4222-8222-222222222222',
    cv_id: '33333333-3333-4333-8333-333333333333',
    version: 1,
    contenido,
    pdf_path: null,
    estado: 'generando',
    created_at: '2026-07-29T12:00:00.000Z',
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
    cover_letter_path: 'cover-letters/abc.pdf',
    snapshot_fecha: '2026-07-29',
  }));

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
      estado: 'activo',
      created_at: '2026-07-29T12:00:00.000Z',
    },
    compras: [],
    vacantes: [],
    strings_booleanos: [],
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
    url_vacante: 'https://ejemplo.com/v', cover_letter_path: null,
    snapshot_fecha: '2026-07-29',
  }));

rechaza('un tipo_fit inventado', () =>
  ContenidoPerfilSchema.parse({
    ...contenido,
    posiciones_alternativas: [{ titulo: 'X', tipo_fit: 'lateral' }],
  }));

rechaza('temporada 4, que no existe', () =>
  CompraSchema.parse({ ...compraBase, temporada: 4 }));

rechaza('precio con decimales: debe ser centavos enteros', () =>
  CompraSchema.parse({ ...compraBase, precio_centavos_mxn: 79.5 }));

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
