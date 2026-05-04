/**
 * Zonificación Lima Metropolitana y Callao según listados oficiales de uso común.
 * Provincias: detección por departamento en el texto del destino.
 */

export const ZONA_KEYS = {
  CALLAO: 'CALLAO',
  CONO_NORTE: 'CONO_NORTE',
  LIMA_TRADICIONAL: 'LIMA_TRADICIONAL',
  CONO_ESTE: 'CONO_ESTE',
  CONO_SUR: 'CONO_SUR',
  PROVINCIA: 'PROVINCIA',
  SIN_CLASIFICAR: 'SIN_CLASIFICAR'
};

export const ZONA_LABELS = {
  [ZONA_KEYS.CALLAO]: 'Callao',
  [ZONA_KEYS.CONO_NORTE]: 'Nueva Lima Norte (Cono Norte)',
  [ZONA_KEYS.LIMA_TRADICIONAL]: 'Lima Tradicional',
  [ZONA_KEYS.CONO_ESTE]: 'Nueva Lima Este (Cono Este)',
  [ZONA_KEYS.CONO_SUR]: 'Nueva Lima Sur (Cono Sur)',
  [ZONA_KEYS.PROVINCIA]: 'Provincia (fuera de Lima Metropolitana)',
  [ZONA_KEYS.SIN_CLASIFICAR]: 'Sin clasificar (complete distrito si aplica)'
};

/** Texto compacto para pestañas */
export const ZONA_TAB_LABEL = {
  [ZONA_KEYS.CALLAO]: 'Callao',
  [ZONA_KEYS.CONO_NORTE]: 'Cono Norte',
  [ZONA_KEYS.LIMA_TRADICIONAL]: 'Lima tradicional',
  [ZONA_KEYS.CONO_ESTE]: 'Cono Este',
  [ZONA_KEYS.CONO_SUR]: 'Cono Sur',
  [ZONA_KEYS.PROVINCIA]: 'Provincia',
  [ZONA_KEYS.SIN_CLASIFICAR]: 'Sin clasificar'
};

/** Orden de bloques en pantalla */
export const ZONE_SORT_ORDER = [
  ZONA_KEYS.CALLAO,
  ZONA_KEYS.CONO_NORTE,
  ZONA_KEYS.LIMA_TRADICIONAL,
  ZONA_KEYS.CONO_ESTE,
  ZONA_KEYS.CONO_SUR,
  ZONA_KEYS.PROVINCIA,
  ZONA_KEYS.SIN_CLASIFICAR
];

export function zoneOrderIndex(zoneKey) {
  const i = ZONE_SORT_ORDER.indexOf(zoneKey);
  return i === -1 ? 999 : i;
}

/** Autorizado en Callao, conos, Lima tradicional, Provincia: lavanda (referencia UI). */
const BG_AUTORIZADO_EN_ZONA = '#EBE8FC';
/** Atendido parcialmente en zona conocida: verde lima pastel (referencia UI). */
const BG_PARCIAL_EN_ZONA = '#DAF7A6';

/** Solo pestaña Sin clasificar: Autorizado = azul claro. */
const BG_AUTORIZADO_SIN_CLASIFICAR = '#dbeafe';
/** Solo pestaña Sin clasificar: Parcial = verde claro (distinto al lima de zonas). */
const BG_PARCIAL_SIN_CLASIFICAR = '#dcfce7';

/** Autor por zona: mismo tono en todas las pestañas de zona; excepción Sin clasificar. */
export const ZONE_BG_AUTORIZADO = {
  [ZONA_KEYS.CALLAO]: BG_AUTORIZADO_EN_ZONA,
  [ZONA_KEYS.CONO_NORTE]: BG_AUTORIZADO_EN_ZONA,
  [ZONA_KEYS.LIMA_TRADICIONAL]: BG_AUTORIZADO_EN_ZONA,
  [ZONA_KEYS.CONO_ESTE]: BG_AUTORIZADO_EN_ZONA,
  [ZONA_KEYS.CONO_SUR]: BG_AUTORIZADO_EN_ZONA,
  [ZONA_KEYS.PROVINCIA]: BG_AUTORIZADO_EN_ZONA,
  [ZONA_KEYS.SIN_CLASIFICAR]: BG_AUTORIZADO_SIN_CLASIFICAR
};

/** Parcial: mismo lima en todas las zonas; en Sin clasificar verde claro. */
export const ZONE_BG_PARCIAL = {
  [ZONA_KEYS.CALLAO]: BG_PARCIAL_EN_ZONA,
  [ZONA_KEYS.CONO_NORTE]: BG_PARCIAL_EN_ZONA,
  [ZONA_KEYS.LIMA_TRADICIONAL]: BG_PARCIAL_EN_ZONA,
  [ZONA_KEYS.CONO_ESTE]: BG_PARCIAL_EN_ZONA,
  [ZONA_KEYS.CONO_SUR]: BG_PARCIAL_EN_ZONA,
  [ZONA_KEYS.PROVINCIA]: BG_PARCIAL_EN_ZONA,
  [ZONA_KEYS.SIN_CLASIFICAR]: BG_PARCIAL_SIN_CLASIFICAR
};

/** Otros estados: tonos muy suaves */
export const ZONE_BG_OTROS = {
  [ZONA_KEYS.CALLAO]: '#f8fafc',
  [ZONA_KEYS.CONO_NORTE]: '#f1f5f9',
  [ZONA_KEYS.LIMA_TRADICIONAL]: '#faf5ff',
  [ZONA_KEYS.CONO_ESTE]: '#f0fdfa',
  [ZONA_KEYS.CONO_SUR]: '#fffbeb',
  [ZONA_KEYS.PROVINCIA]: '#fff1f2',
  [ZONA_KEYS.SIN_CLASIFICAR]: '#e5e7eb'
};

/** Barra lateral en el título de zona (identificación rápida) */
export const ZONE_ACCENT = {
  [ZONA_KEYS.CALLAO]: '#2563eb',
  [ZONA_KEYS.CONO_NORTE]: '#4f46e5',
  [ZONA_KEYS.LIMA_TRADICIONAL]: '#7c3aed',
  [ZONA_KEYS.CONO_ESTE]: '#0891b2',
  [ZONA_KEYS.CONO_SUR]: '#0284c7',
  [ZONA_KEYS.PROVINCIA]: '#db2777',
  [ZONA_KEYS.SIN_CLASIFICAR]: '#64748b'
};

/**
 * @param {string} estadoNorm - resultado de normalizeEstado (autorizado | atendido parcialmente | …)
 * @param {string} zoneKey
 */
export function bgForEstadoZona(estadoNorm, zoneKey) {
  const k = zoneKey || ZONA_KEYS.SIN_CLASIFICAR;
  if (estadoNorm === 'autorizado') {
    return ZONE_BG_AUTORIZADO[k] ?? ZONE_BG_AUTORIZADO[ZONA_KEYS.SIN_CLASIFICAR];
  }
  if (estadoNorm === 'atendido parcialmente') {
    return ZONE_BG_PARCIAL[k] ?? ZONE_BG_PARCIAL[ZONA_KEYS.SIN_CLASIFICAR];
  }
  return ZONE_BG_OTROS[k] ?? '#f3f4f6';
}

/** Normaliza para comparar texto de dirección / distrito */
export function normalizeZonaText(val) {
  return String(val || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CALLAO = [
  'bellavista',
  'callao',
  'carmen de la legua',
  'la perla',
  'la punta',
  'ventanilla'
];

const CONO_NORTE = [
  'ancon',
  'carabayllo',
  'comas',
  'independencia',
  'los olivos',
  'puente piedra',
  'san martin de porres',
  'santa rosa'
];

const CONO_ESTE = [
  'ate',
  'chaclacayo',
  'cieneguilla',
  'el agustino',
  'lurigancho',
  'san juan de lurigancho',
  'san luis',
  'santa anita'
];

const CONO_SUR = [
  'chorrillos',
  'lurin',
  'pachacamac',
  'pucusana',
  'punta hermosa',
  'punta negra',
  'san bartolo',
  'san juan de miraflores',
  'santa maria',
  'villa el salvador',
  'villa maria del triunfo'
];

const LIMA_TRADICIONAL = [
  'barranco',
  'brena',
  'jesus maria',
  'la molina',
  'la victoria',
  'lima',
  'lince',
  'magdalena',
  'miraflores',
  'pueblo libre',
  'rimac',
  'san borja',
  'san isidro',
  'san miguel',
  'surco',
  'surquillo'
];

/** Frases que deben evaluarse antes que el distrito suelto "chorrillos" */
const PHRASE_OVERRIDES = [{ phrase: 'chorrillos antiguo', zone: ZONA_KEYS.LIMA_TRADICIONAL }];

/**
 * Perú — departamentos (regiones) fuera de Lima Metropolitana y capitales.
 * Referencia estable para análisis y pestaña "Provincia" (texto destino o distrito manual).
 * Región Lima: capital Huacho. No incluimos el token suelto "lima" como departamento para no
 * competir con el distrito Lima de LM en direcciones típicas.
 */
export const PROVINCIA_REFERENCIA_DEP_CAPITAL = Object.freeze([
  Object.freeze(['Amazonas', 'Chachapoyas']),
  Object.freeze(['Áncash', 'Huaraz']),
  Object.freeze(['Apurímac', 'Abancay']),
  Object.freeze(['Arequipa', 'Arequipa']),
  Object.freeze(['Ayacucho', 'Ayacucho']),
  Object.freeze(['Cajamarca', 'Cajamarca']),
  Object.freeze(['Cusco', 'Cusco']),
  Object.freeze(['Huancavelica', 'Huancavelica']),
  Object.freeze(['Huánuco', 'Huánuco']),
  Object.freeze(['Ica', 'Ica']),
  Object.freeze(['Junín', 'Huancayo']),
  Object.freeze(['La Libertad', 'Trujillo']),
  Object.freeze(['Lambayeque', 'Chiclayo']),
  Object.freeze(['Loreto', 'Iquitos']),
  Object.freeze(['Madre de Dios', 'Puerto Maldonado']),
  Object.freeze(['Moquegua', 'Moquegua']),
  Object.freeze(['Pasco', 'Cerro de Pasco']),
  Object.freeze(['Piura', 'Piura']),
  Object.freeze(['Puno', 'Puno']),
  Object.freeze(['San Martín', 'Moyobamba']),
  Object.freeze(['Tacna', 'Tacna']),
  Object.freeze(['Tumbes', 'Tumbes']),
  Object.freeze(['Ucayali', 'Pucallpa']),
  Object.freeze(['Región Lima', 'Huacho'])
]);

/** Términos únicos normalizados (departamento o capital), más largos primero para matchear antes en texto */
function buildProvinciaTermsSorted() {
  const set = new Set();
  for (const [dep, cap] of PROVINCIA_REFERENCIA_DEP_CAPITAL) {
    const d = normalizeZonaText(dep);
    const c = normalizeZonaText(cap);
    if (d) set.add(d);
    if (c) set.add(c);
  }
  set.add('cuzco');
  return [...set].sort((a, b) => b.length - a.length);
}

const PROVINCIA_TERMS_SORTED = buildProvinciaTermsSorted();
const PROVINCIA_TERMS_EXACT = new Set(PROVINCIA_TERMS_SORTED);

/** Distrito manual: si coincide exactamente (normalizado) con dep/capital → zona Provincia */
function matchProvinciaManualTerm(normManual) {
  if (!normManual) return null;
  return PROVINCIA_TERMS_EXACT.has(normManual) ? normManual : null;
}

function buildDistrictToZone() {
  const map = new Map();
  const add = (arr, zone) => {
    for (const d of arr) {
      map.set(d, zone);
    }
  };
  add(CALLAO, ZONA_KEYS.CALLAO);
  add(CONO_NORTE, ZONA_KEYS.CONO_NORTE);
  add(CONO_ESTE, ZONA_KEYS.CONO_ESTE);
  add(CONO_SUR, ZONA_KEYS.CONO_SUR);
  add(LIMA_TRADICIONAL, ZONA_KEYS.LIMA_TRADICIONAL);
  return map;
}

const DISTRITO_TO_ZONE = buildDistrictToZone();

/** Lista distrito normalizado → zona, para texto manual del usuario */
export function zonaFromDistritoName(distritoNormalizado) {
  const n = normalizeZonaText(distritoNormalizado);
  if (!n) return null;
  if (DISTRITO_TO_ZONE.has(n)) {
    return {
      zoneKey: DISTRITO_TO_ZONE.get(n),
      distritoMatched: n
    };
  }
  /** Coincidencia parcial: una sola palabra (ej. "comas") */
  for (const [dist, zone] of DISTRITO_TO_ZONE) {
    if (dist.includes(n) || n.includes(dist)) {
      return { zoneKey: zone, distritoMatched: dist };
    }
  }
  const provManual = matchProvinciaManualTerm(n);
  if (provManual) {
    return { zoneKey: ZONA_KEYS.PROVINCIA, distritoMatched: provManual };
  }
  return null;
}

function phraseInDestino(normDestino, phrase) {
  const p = ` ${phrase} `;
  const d = ` ${normDestino} `;
  return d.includes(p);
}

/**
 * Busca el distrito más largo que aparezca como subcadena en el destino.
 */
function matchDistrictInDestino(normDestino) {
  const candidates = [...DISTRITO_TO_ZONE.keys()].sort((a, b) => b.length - a.length);
  for (const phrase of PHRASE_OVERRIDES) {
    if (phraseInDestino(normDestino, phrase.phrase)) {
      return { distrito: phrase.phrase, zoneKey: phrase.zone };
    }
  }
  for (const dist of candidates) {
    if (phraseInDestino(normDestino, dist)) {
      return { distrito: dist, zoneKey: DISTRITO_TO_ZONE.get(dist) };
    }
  }
  return null;
}

/**
 * True si el destino ya permite zonificar sin depender del distrito manual (Lima/Callao o provincia/capital).
 */
export function hasDetectableDistritoInDestino(destino) {
  const raw = String(destino || '').trim();
  if (!raw) return false;
  const norm = normalizeZonaText(raw);
  return !!matchDistrictInDestino(norm) || !!matchProvincia(norm);
}

function matchProvincia(normDestino) {
  const padded = ` ${normDestino} `;
  for (const term of PROVINCIA_TERMS_SORTED) {
    if (padded.includes(` ${term} `)) {
      return term;
    }
  }
  return null;
}

/**
 * @param {string} destino - Texto columna destino
 * @param {string|null|undefined} distritoManual - Distrito indicado por el usuario (normalizado internamente)
 */
/** Clave estable para persistir distrito manual por fila */
export function logisticsRowKey(row) {
  const est = String(row?.estado || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  return [
    est,
    String(row?.destino ?? ''),
    String(row?.fecha ?? ''),
    String(row?.cliente ?? ''),
    String(row?.producto ?? ''),
    String(row?.cantidad ?? '')
  ].join('\u0001');
}

export function inferZonaFromDestino(destino, distritoManual) {
  const raw = String(destino || '').trim();
  if (!raw) {
    return {
      zoneKey: ZONA_KEYS.SIN_CLASIFICAR,
      zoneLabel: ZONA_LABELS[ZONA_KEYS.SIN_CLASIFICAR],
      distritoMatched: null,
      needsManualDistrito: true
    };
  }

  const norm = normalizeZonaText(raw);

  const fromAddr = matchDistrictInDestino(norm);
  if (fromAddr) {
    return {
      zoneKey: fromAddr.zoneKey,
      zoneLabel: ZONA_LABELS[fromAddr.zoneKey],
      distritoMatched: fromAddr.distrito,
      needsManualDistrito: false
    };
  }

  const manual = distritoManual != null && String(distritoManual).trim() !== ''
    ? zonaFromDistritoName(distritoManual)
    : null;

  if (manual) {
    return {
      zoneKey: manual.zoneKey,
      zoneLabel: ZONA_LABELS[manual.zoneKey],
      distritoMatched: manual.distritoMatched,
      needsManualDistrito: false
    };
  }

  const dep = matchProvincia(norm);
  if (dep) {
    return {
      zoneKey: ZONA_KEYS.PROVINCIA,
      zoneLabel: ZONA_LABELS[ZONA_KEYS.PROVINCIA],
      distritoMatched: dep,
      needsManualDistrito: false
    };
  }

  return {
    zoneKey: ZONA_KEYS.SIN_CLASIFICAR,
    zoneLabel: ZONA_LABELS[ZONA_KEYS.SIN_CLASIFICAR],
    distritoMatched: null,
    needsManualDistrito: true
  };
}
