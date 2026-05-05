import { useMemo, useState, useEffect } from 'react';
import { AlertCircle, MapPin, X, ExternalLink, MapPinned } from 'lucide-react';
import {
  inferZonaFromDestino,
  hasDetectableDistritoInDestino,
  logisticsRowKey,
  bgForEstadoZona,
  ZONE_ACCENT,
  ZONE_SORT_ORDER,
  ZONA_TAB_LABEL,
  ZONA_KEYS,
  normalizeZonaText
} from '../data/limaZonas';

const HEADER_LABELS = {
  centro: 'CENTRO',
  fecha: 'FECHA',
  vendedor: 'VENDEDOR',
  cliente: 'CLIENTE',
  producto: 'PRODUCTO',
  cantidad: 'CANTIDAD',
  atendido: 'ATENDIDO',
  pendiente: 'PENDIENTE',
  destino: 'DESTINO',
  estado: 'ESTADO'
};

/** Orden de columnas en tabla; atendido/pendiente van después de cantidad. */
const LOGISTICS_TABLE_COLUMN_ORDER = [
  'centro',
  'fecha',
  'vendedor',
  'cliente',
  'producto',
  'cantidad',
  'atendido',
  'pendiente',
  'destino',
  'estado'
];

/** Pestañas Ejecutado / Rechazado: tabla simple solo lectura (sin mapas ni distrito). */
const VISTA_ESTADO_LECTURA_KEYS = [
  'fecha',
  'vendedor',
  'cliente',
  'producto',
  'cantidad',
  'atendido',
  'pendiente',
  'destino',
  'estado'
];

function parseAnalysisNumber(raw) {
  if (raw === '' || raw == null) return 0;
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Asegura columnas ATENDIDO y PENDIENTE en la tabla (pendiente = max(cantidad - atendido, 0)).
 * Útil si la API/cache aún devuelve el esquema antiguo sin esas llaves en `columns`.
 */
function normalizePedidoLogisticsSheet(sheet) {
  if (!sheet || !Array.isArray(sheet.columns) || !Array.isArray(sheet.logisticsRows)) {
    return sheet;
  }

  const colByKey = new Map(sheet.columns.map((c) => [c.key, c]));

  const logisticsRows = sheet.logisticsRows.map((row) => {
    const cantidad = parseAnalysisNumber(row.cantidad);
    const atNum =
      row.atendido !== '' && row.atendido != null ? parseAnalysisNumber(row.atendido) : 0;
    const pendiente = Math.max(cantidad - atNum, 0);
    return {
      ...row,
      atendido: atNum,
      pendiente
    };
  });

  const columns = [];
  const seen = new Set();

  for (const key of LOGISTICS_TABLE_COLUMN_ORDER) {
    if (key === 'atendido' || key === 'pendiente') {
      columns.push(
        colByKey.get(key) || {
          key,
          name: HEADER_LABELS[key] || key
        }
      );
      seen.add(key);
      continue;
    }
    if (colByKey.has(key)) {
      columns.push(colByKey.get(key));
      seen.add(key);
    }
  }

  for (const c of sheet.columns) {
    if (!seen.has(c.key)) {
      columns.push(c);
      seen.add(c.key);
    }
  }

  return {
    ...sheet,
    columns,
    logisticsRows
  };
}

/** Verde cabecera tipo hoja de cálculo */
const HEADER_BG = '#1a6c47';
/** Línea límite entre grupos de vendedor (y entre bloques de estado) */
const VENDEDOR_GROUP_BORDER = '#0f3d28';
/** Fondo vacío / mensaje sin filas */
const ROW_BG_AUTORIZADO = '#a8d4f0';
/** Celeste suave al pasar el puntero */
const ROW_BG_HOVER = '#dff3ff';

const DISTRITO_OVERRIDES_STORAGE_KEY = 'logistica_distrito_overrides_v1';

function emptyDistritoOverrides() {
  return { byDestinoNorm: {}, byRowKey: {} };
}

function loadDistritoOverridesFromStorage() {
  try {
    const raw = localStorage.getItem(DISTRITO_OVERRIDES_STORAGE_KEY);
    if (!raw) return emptyDistritoOverrides();
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return emptyDistritoOverrides();
    if ('byDestinoNorm' in p || 'byRowKey' in p) {
      return {
        byDestinoNorm:
          p.byDestinoNorm && typeof p.byDestinoNorm === 'object' ? { ...p.byDestinoNorm } : {},
        byRowKey: p.byRowKey && typeof p.byRowKey === 'object' ? { ...p.byRowKey } : {}
      };
    }
    return { byDestinoNorm: {}, byRowKey: { ...p } };
  } catch {
    return emptyDistritoOverrides();
  }
}

/** Distrito manual: primero por destino normalizado (todas las filas iguales), luego por fila. */
function resolveDistritoManual(row, overrides) {
  if (!overrides || typeof overrides !== 'object') return undefined;
  const destNorm = normalizeZonaText(row.destino);
  if (destNorm) {
    const dv = overrides.byDestinoNorm?.[destNorm];
    if (dv != null && String(dv).trim() !== '') return String(dv).trim();
  }
  const rk = logisticsRowKey(row);
  const rv = overrides.byRowKey?.[rk];
  if (rv != null && String(rv).trim() !== '') return String(rv).trim();
  return undefined;
}

function mergeDistritoSave(row, dist, sheetRows, prev) {
  const trimmed = String(dist).trim();
  if (!trimmed) return prev || emptyDistritoOverrides();
  const safe =
    prev && typeof prev === 'object' && (prev.byDestinoNorm || prev.byRowKey)
      ? prev
      : { byDestinoNorm: {}, byRowKey: {} };
  const base = {
    byDestinoNorm: { ...(safe.byDestinoNorm || {}) },
    byRowKey: { ...(safe.byRowKey || {}) }
  };
  const destNorm = normalizeZonaText(row.destino);
  const rk = logisticsRowKey(row);
  if (destNorm) {
    base.byDestinoNorm[destNorm] = trimmed;
    for (const r of sheetRows) {
      if (normalizeZonaText(r.destino) === destNorm) {
        delete base.byRowKey[logisticsRowKey(r)];
      }
    }
  } else {
    base.byRowKey[rk] = trimmed;
  }
  return base;
}

function sanitizeEstadoCellRawUi(value) {
  if (value == null || value === '') return '';
  let s = String(value)
    .replace(/^\ufeff/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .replace(/\u00a0/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function normalizeEstado(val) {
  const pre = sanitizeEstadoCellRawUi(val);
  if (!pre) return '';
  return pre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Parcial / plural / orden tipo "PARCIALMENTE ATENDIDOS". */
function isAtendidoParcialNorm(n) {
  if (!n) return false;
  const partial = n.includes('parcialmente') || /\bparcial\b/.test(n);
  if (!partial) return false;
  return /\batendid(o|os|a|as)\b/.test(n);
}

const FORMS_AUTORIZADO_UI = new Set(['autorizado', 'autorizada', 'autorizados', 'autorizadas']);
const FORMS_EJECUTADO_UI = new Set(['ejecutado', 'ejecutada', 'ejecutados', 'ejecutadas']);
const FORMS_RECHAZADO_UI = new Set(['rechazado', 'rechazada', 'rechazados', 'rechazadas']);

function estadoPhraseLooksNegatedUi(v) {
  return /\b(no|sin)\s+(autorizad|ejecutad|rechazad)/.test(` ${v} `);
}

/** Claves alineadas con el backend para filtros, pestañas y colores por fila. */
function canonicalEstadoKey(raw) {
  let n = normalizeEstado(raw);
  if (!n) return '';
  n = n.replace(/^[\s"'«»[\]()]+|[\s"'«»[\]().]+$/g, '').replace(/\.+$/g, '').trim();
  if (!n) return '';
  if (isAtendidoParcialNorm(n)) {
    return 'atendido parcialmente';
  }
  if (FORMS_AUTORIZADO_UI.has(n)) return 'autorizado';
  if (FORMS_EJECUTADO_UI.has(n)) return 'ejecutado';
  if (FORMS_RECHAZADO_UI.has(n)) return 'rechazado';

  if (!estadoPhraseLooksNegatedUi(n)) {
    if (/\bautorizad(o|a|os|as)\b/.test(n)) return 'autorizado';
    if (/\bejecutad(o|a|os|as)\b/.test(n)) return 'ejecutado';
    if (/\brechazad(o|a|os|as)\b/.test(n)) return 'rechazado';
  }
  return n;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDisplayDate(raw) {
  if (raw === '' || raw == null) return '';
  if (raw instanceof Date && !isNaN(raw)) {
    return `${pad2(raw.getDate())}-${pad2(raw.getMonth() + 1)}-${raw.getFullYear()}`;
  }
  const s = String(raw).trim();
  if (!s) return '';

  const dMdy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dMdy) {
    return `${pad2(dMdy[1])}-${pad2(dMdy[2])}-${dMdy[3]}`;
  }

  const ymd = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (ymd) {
    return `${pad2(ymd[3])}-${pad2(ymd[2])}-${ymd[1]}`;
  }

  const t = Date.parse(s);
  if (!isNaN(t)) {
    const d = new Date(t);
    return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
  }

  const serial = Number(s);
  if (!Number.isNaN(serial) && serial > 20000 && serial < 1000000) {
    const epoch = new Date(1899, 11, 30);
    const ms = epoch.getTime() + Math.round(serial * 86400000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
    }
  }

  return s;
}

/** Para ordenar: más reciente = mayor timestamp; sin fecha válida → 0 (van al final al ordenar desc). */
function parseFechaToTimestamp(raw) {
  if (raw === '' || raw == null) return 0;
  if (raw instanceof Date && !isNaN(raw)) {
    return raw.getTime();
  }
  const s = String(raw).trim();
  if (!s) return 0;

  const dMdy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dMdy) {
    const d = new Date(Number(dMdy[3]), Number(dMdy[2]) - 1, Number(dMdy[1]));
    const t = d.getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  const ymd = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    const t = d.getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return t;

  const serial = Number(s);
  if (!Number.isNaN(serial) && serial > 20000 && serial < 1000000) {
    const epoch = new Date(1899, 11, 30);
    const ms = epoch.getTime() + Math.round(serial * 86400000);
    return Number.isNaN(ms) ? 0 : ms;
  }

  return 0;
}

function normalizeVendedorKey(val) {
  if (val == null || val === '') return '';
  return String(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Mismo vendedor consecutivo dentro de la misma zona y color de estado → rowspan. */
function computeVendedorRowSpans(displayRows) {
  const spans = displayRows.map(() => 1);
  let i = 0;
  while (i < displayRows.length) {
    const item = displayRows[i];
    if (item.kind === 'zone') {
      spans[i] = 0;
      i++;
      continue;
    }
    const { row, bg, zoneKey } = item;
    const vk = normalizeVendedorKey(row.vendedor);
    let j = i + 1;
    while (j < displayRows.length) {
      const next = displayRows[j];
      if (next.kind === 'zone') break;
      if (
        next.bg !== bg ||
        next.zoneKey !== zoneKey ||
        normalizeVendedorKey(next.row.vendedor) !== vk
      ) {
        break;
      }
      j++;
    }
    const len = j - i;
    spans[i] = len;
    for (let k = i + 1; k < j; k++) spans[k] = 0;
    i = j;
  }
  return spans;
}

/** Primera fila de un nuevo vendedor dentro del mismo estado → línea separadora (una zona por pestaña). */
function shouldShowGroupSeparator(displayRows, rowIdx) {
  const cur = displayRows[rowIdx];
  if (cur.kind !== 'data') return false;
  if (rowIdx <= 0) return false;
  let prevIdx = rowIdx - 1;
  while (prevIdx >= 0 && displayRows[prevIdx].kind === 'zone') prevIdx--;
  if (prevIdx < 0) return false;
  const prev = displayRows[prevIdx];
  if (prev.kind !== 'data') return false;
  if (prev.bg !== cur.bg) return true;
  return normalizeVendedorKey(prev.row.vendedor) !== normalizeVendedorKey(cur.row.vendedor);
}

function enrichRowZona(row, getDistritoOverride) {
  const manual = getDistritoOverride(row);
  const info = inferZonaFromDestino(row.destino, manual);
  return {
    row,
    estadoNorm: canonicalEstadoKey(row.estado),
    zoneKey: info.zoneKey,
    zoneLabel: info.zoneLabel,
    needsDistrito: info.needsManualDistrito
  };
}

function columnsForEstadoReadonlyView(sheet) {
  const colByKey = new Map((sheet.columns || []).map((c) => [c.key, c]));
  return VISTA_ESTADO_LECTURA_KEYS.map((key) => ({
    key,
    name: HEADER_LABELS[key] || colByKey.get(key)?.name || key
  }));
}

/** Todas las filas del filtro actual (sin agrupar por zona ni vendedor). */
function buildFlatEstadoReadonlyRows(rows, getDistritoOverride) {
  const sorted = [...rows].sort((a, b) => {
    const ta = parseFechaToTimestamp(a.fecha);
    const tb = parseFechaToTimestamp(b.fecha);
    if (tb !== ta) return tb - ta;
    return normalizeVendedorKey(a.vendedor).localeCompare(normalizeVendedorKey(b.vendedor), 'es');
  });
  return sorted.map((row, rowIdx) => {
    const e = enrichRowZona(row, getDistritoOverride);
    const zebra = rowIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
    return {
      kind: 'data',
      row,
      bg: zebra,
      zoneKey: e.zoneKey,
      zoneLabel: e.zoneLabel,
      needsDistrito: false
    };
  });
}

/** Búsqueda en Google Maps: incluye distrito/provincia manual si no está ya en el texto del destino. */
function buildMapsSearchQuery(row, destinoRaw, getDistritoOverride) {
  const base = String(destinoRaw || '').trim();
  if (!base) return '';
  const manual = getDistritoOverride(row);
  const manualTrim = manual != null ? String(manual).trim() : '';
  const hasLocInText = hasDetectableDistritoInDestino(base);
  const suffix = ', Perú';
  if (manualTrim && !hasLocInText) {
    return `${base}, ${manualTrim}${suffix}`;
  }
  return `${base}${suffix}`;
}

/** En zonas solo se renderiza estado AUTORIZADO (incluye Sin clasificar). */
function prepareGroupedRowsForZone(rows, getDistritoOverride, zoneKey) {
  const autorizado = [];
  for (const row of rows) {
    const e = enrichRowZona(row, getDistritoOverride);
    if (e.zoneKey !== zoneKey) continue;
    if (e.estadoNorm !== ESTADO_TAB.AUTORIZADO) continue;
    autorizado.push(e);
  }

  autorizado.sort((a, b) => {
    const va = normalizeVendedorKey(a.row.vendedor);
    const vb = normalizeVendedorKey(b.row.vendedor);
    if (va !== vb) return va.localeCompare(vb, 'es');
    return parseFechaToTimestamp(b.row.fecha) - parseFechaToTimestamp(a.row.fecha);
  });

  return autorizado.map((item) => ({
    kind: 'data',
    row: item.row,
    bg: bgForEstadoZona(item.estadoNorm, item.zoneKey),
    zoneKey: item.zoneKey,
    zoneLabel: item.zoneLabel,
    needsDistrito: item.needsDistrito
  }));
}

function countRowsByZone(rows, getDistritoOverride) {
  const counts = {};
  for (const z of ZONE_SORT_ORDER) counts[z] = 0;
  for (const row of rows) {
    const e = enrichRowZona(row, getDistritoOverride);
    counts[e.zoneKey] = (counts[e.zoneKey] || 0) + 1;
  }
  return counts;
}

function zonesWithData(counts) {
  return ZONE_SORT_ORDER.filter((z) => counts[z] > 0);
}

/** Filtro de estado en barra (solo ejecutado / rechazado; el resto se ve eligiendo zona). */
const ESTADO_TAB = {
  ALL: '__all__',
  AUTORIZADO: 'autorizado',
  PARCIAL: 'atendido parcialmente',
  EJECUTADO: 'ejecutado',
  RECHAZADO: 'rechazado',
  SIN_ESTADO: '__sin_estado__'
};

const ESTADO_TAB_ORDER = [
  ESTADO_TAB.ALL,
  ESTADO_TAB.AUTORIZADO,
  ESTADO_TAB.PARCIAL,
  ESTADO_TAB.EJECUTADO,
  ESTADO_TAB.RECHAZADO,
  ESTADO_TAB.SIN_ESTADO
];

const ESTADO_TAB_LABEL = {
  [ESTADO_TAB.ALL]: 'Autorizados por zona',
  [ESTADO_TAB.AUTORIZADO]: 'Autorizado',
  [ESTADO_TAB.PARCIAL]: 'Atendido parcialmente',
  [ESTADO_TAB.EJECUTADO]: 'Ejecutado',
  [ESTADO_TAB.RECHAZADO]: 'Rechazado',
  [ESTADO_TAB.SIN_ESTADO]: 'Sin estado'
};

/** Tras zonas: solo Ejecutado y Rechazado (no dependen del distrito). */
const ESTADO_FILTROS_EN_BARRA = [ESTADO_TAB.EJECUTADO, ESTADO_TAB.RECHAZADO];

const ESTADO_TAB_ACCENT = {
  [ESTADO_TAB.ALL]: '#64748b',
  [ESTADO_TAB.AUTORIZADO]: '#7c3aed',
  [ESTADO_TAB.PARCIAL]: '#15803d',
  [ESTADO_TAB.EJECUTADO]: '#0d9488',
  [ESTADO_TAB.RECHAZADO]: '#e11d48',
  [ESTADO_TAB.SIN_ESTADO]: '#94a3b8'
};

function rowMatchesEstadoTab(row, tabKey) {
  const n = canonicalEstadoKey(row.estado);
  if (tabKey === ESTADO_TAB.ALL) return n === ESTADO_TAB.AUTORIZADO;
  if (tabKey === ESTADO_TAB.SIN_ESTADO) return n === '';
  return n === tabKey;
}

function filterRowsByEstadoTab(rows, tabKey) {
  return rows.filter((row) => rowMatchesEstadoTab(row, tabKey));
}

function countRowsByEstadoGroups(rows) {
  const out = {};
  for (const k of ESTADO_TAB_ORDER) {
    out[k] = k === ESTADO_TAB.ALL ? rows.length : filterRowsByEstadoTab(rows, k).length;
  }
  return out;
}

function formatDisplayCell(colKey, raw) {
  if (raw === '' || raw == null) return '';
  if (colKey === 'fecha') {
    return formatDisplayDate(raw);
  }
  if (colKey === 'cantidad' || colKey === 'atendido' || colKey === 'pendiente') {
    const n = Number(String(raw).replace(',', '.').replace(/\s/g, ''));
    if (!Number.isNaN(n)) {
      return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
    }
  }
  if (
    colKey === 'centro' ||
    colKey === 'vendedor' ||
    colKey === 'cliente' ||
    colKey === 'producto' ||
    colKey === 'destino' ||
    colKey === 'estado'
  ) {
    return String(raw).toUpperCase();
  }
  return String(raw);
}

function MapsModal({ query, onClose }) {
  const encoded = encodeURIComponent(query);
  const embedSrc = `https://www.google.com/maps?q=${encoded}&hl=es&z=16&output=embed`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="maps-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-[min(96vw,1500px)] h-[min(92vh,920px)] max-h-[96vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <h2 id="maps-modal-title" className="text-sm sm:text-base font-semibold text-gray-900 break-words text-left pr-2">
            {query}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-800 shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="relative w-full flex-1 min-h-[50vh] bg-gray-100">
          <iframe
            key={embedSrc}
            title={`Mapa: ${query}`}
            className="absolute inset-0 w-full h-full border-0 bg-gray-100"
            loading="lazy"
            referrerPolicy="origin"
            src={embedSrc}
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50 shrink-0">
          <span className="text-[11px] text-gray-500">
            Si no carga el mapa, usa el enlace directo:
          </span>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-800"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir en Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}

function DistritoFormPopover({ onSave, onClose, initialValue = '' }) {
  const [val, setVal] = useState(initialValue);
  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);
  return (
    <div
      className="absolute right-0 top-full mt-1 z-[60] p-2 bg-white border border-amber-300 rounded shadow-lg text-left min-w-[220px]"
      role="dialog"
      aria-label="Indicar distrito"
    >
      <p className="text-[10px] text-amber-900 mb-1 leading-snug">
        Escriba el distrito para ubicar el pedido en su zona (Lima / Callao). Si varias filas repiten el
        mismo texto en <strong>Destino</strong>, este distrito se aplica a todas y pasan juntas de pestaña.
      </p>
      <input
        type="text"
        className="w-full border border-gray-300 rounded px-1.5 py-1 text-[11px] mb-1.5"
        placeholder="Ej: Comas, Miraflores…"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        autoFocus
      />
      <div className="flex gap-1 justify-end">
        <button
          type="button"
          className="text-[10px] px-2 py-0.5 rounded text-gray-600 hover:bg-gray-100"
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="text-[10px] px-2 py-0.5 rounded bg-primary-600 text-white hover:bg-primary-700"
          onClick={() => {
            const t = val.trim();
            if (t) onSave(t);
            onClose();
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function LogisticsTable({
  sheet,
  activeZone,
  distritoOverrides,
  setDistritoOverrides,
  allLogisticsRows,
  stickyTableHead = true,
  /** Hay datos en la hoja pero el filtro Ejecutado/Rechazado dejó 0 filas. */
  emptyBecauseEstadoFilter = false,
  onClearEstadoFilter,
  /** Ejecutado/Rechazado: lista plana y columnas reducidas, sin mapas ni distrito. */
  vistaLecturaSoloEstado = false
}) {
  const [mapQuery, setMapQuery] = useState(null);
  const [hoveredRowIdx, setHoveredRowIdx] = useState(null);
  const [distritoFormKey, setDistritoFormKey] = useState(null);

  const rowsForDistritoMerge = allLogisticsRows ?? sheet.logisticsRows ?? [];

  const getDistritoOverride = useMemo(
    () => (row) => resolveDistritoManual(row, distritoOverrides),
    [distritoOverrides]
  );

  const { displayRows, vendedorRowSpans, displayColumns } = useMemo(() => {
    if (vistaLecturaSoloEstado) {
      const dc = columnsForEstadoReadonlyView(sheet);
      if (!sheet.logisticsRows?.length) {
        return { displayRows: [], vendedorRowSpans: [], displayColumns: dc };
      }
      const flat = buildFlatEstadoReadonlyRows(sheet.logisticsRows, getDistritoOverride);
      return {
        displayRows: flat,
        vendedorRowSpans: flat.map(() => 1),
        displayColumns: dc
      };
    }
    if (activeZone == null) {
      return {
        displayRows: [],
        vendedorRowSpans: [],
        displayColumns: sheet.columns
      };
    }
    const rows = prepareGroupedRowsForZone(sheet.logisticsRows, getDistritoOverride, activeZone);
    return {
      displayRows: rows,
      vendedorRowSpans: computeVendedorRowSpans(rows),
      displayColumns: sheet.columns
    };
  }, [
    vistaLecturaSoloEstado,
    sheet,
    sheet.logisticsRows,
    sheet.columns,
    getDistritoOverride,
    activeZone
  ]);

  return (
    <>
    <div className="w-full overflow-x-auto rounded-sm shadow-md">
      <table
        className="w-full border-collapse text-center text-xs"
        style={{ fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif' }}
      >
        <thead
          className={
            stickyTableHead ? 'sticky top-0 z-10 shadow-sm' : 'shadow-sm'
          }
        >
          <tr style={{ backgroundColor: HEADER_BG, color: '#fff' }}>
            {displayColumns.map((col) => (
              <th
                key={col.key}
                className="font-bold text-[11px] leading-tight uppercase tracking-wide px-2 py-2 align-middle select-none"
                style={{ border: 'none', backgroundColor: HEADER_BG }}
              >
                <span className="inline-flex items-center justify-center gap-1">
                  {col.key === 'destino' &&
                  !vistaLecturaSoloEstado &&
                  activeZone != null &&
                  activeZone !== ZONA_KEYS.SIN_CLASIFICAR ? (
                    <MapPin className="w-3 h-3 text-white/90 shrink-0" aria-hidden />
                  ) : null}
                  {HEADER_LABELS[col.key] || String(col.name).toUpperCase()}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.logisticsRows.length === 0 ? (
            <tr style={{ backgroundColor: emptyBecauseEstadoFilter ? '#f0fdf4' : ROW_BG_AUTORIZADO }}>
              <td
                colSpan={displayColumns.length}
                className="px-3 py-4 text-xs text-black text-center space-y-2"
                style={{ border: 'none' }}
              >
                {emptyBecauseEstadoFilter ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-gray-800 max-w-md">
                      No hay filas con estado <strong>Ejecutado</strong> o <strong>Rechazado</strong> para este
                      archivo/filtro. Pulse aquí para volver al flujo por zonas (solo autorizados).
                    </p>
                    {typeof onClearEstadoFilter === 'function' ? (
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
                        onClick={onClearEstadoFilter}
                      >
                        Volver a zonas autorizadas
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <span>
                    No hay filas de datos válidas o el archivo no trae todas las columnas requeridas.
                  </span>
                )}
              </td>
            </tr>
          ) : displayRows.length === 0 ? (
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <td
                colSpan={displayColumns.length}
                className="px-3 py-6 text-xs text-gray-600 text-center"
                style={{ border: 'none' }}
              >
                No hay pedidos autorizados en esta zona.
              </td>
            </tr>
          ) : (
            displayRows.map((item, rowIdx) => {
              const { row, bg, needsDistrito, zoneKey } = item;
              const rk = logisticsRowKey(row);
              const showGroupSep =
                !vistaLecturaSoloEstado && shouldShowGroupSeparator(displayRows, rowIdx);
              const sepCellStyle = showGroupSep
                ? { borderTop: `2px solid ${VENDEDOR_GROUP_BORDER}` }
                : {};

              return (
                <tr
                  key={`d-${rk}-${rowIdx}`}
                  style={{ backgroundColor: hoveredRowIdx === rowIdx ? ROW_BG_HOVER : bg }}
                  onMouseEnter={() => setHoveredRowIdx(rowIdx)}
                  onMouseLeave={() => setHoveredRowIdx(null)}
                >
                  {vistaLecturaSoloEstado
                    ? displayColumns.map((col) => {
                        const v = row[col.key];
                        return (
                          <td
                            key={col.key}
                            className="px-2 py-1.5 text-[11px] text-black leading-snug align-middle break-words text-center"
                            style={{ border: 'none', ...sepCellStyle }}
                            title={row[col.key] != null ? String(row[col.key]) : ''}
                          >
                            {v === '' || v == null ? '' : formatDisplayCell(col.key, v)}
                          </td>
                        );
                      })
                    : displayColumns.map((col) => {
                    const v = row[col.key];
                    const isDestino = col.key === 'destino';
                    const isVendedor = col.key === 'vendedor';
                    const destinoRaw =
                      isDestino && v != null && String(v).trim() !== '' ? String(v).trim() : '';

                    if (isVendedor) {
                      const rs = vendedorRowSpans[rowIdx];
                      if (rs === 0) return null;
                      return (
                        <td
                          key={col.key}
                          rowSpan={rs}
                          className="px-2 py-1.5 text-[11px] text-black leading-snug align-middle break-words text-center"
                          style={{ border: 'none', verticalAlign: 'middle', textAlign: 'center', ...sepCellStyle }}
                          title={v != null ? String(v) : ''}
                        >
                          <span className="inline-block max-w-full text-center">
                            {v === '' || v == null ? '' : formatDisplayCell(col.key, v)}
                          </span>
                        </td>
                      );
                    }

                    if (isDestino) {
                      const manualDist = getDistritoOverride(row);
                      const manualDistTrim =
                        manualDist != null && String(manualDist).trim() !== ''
                          ? String(manualDist).trim()
                          : '';
                      const detectedInText =
                        destinoRaw !== '' ? hasDetectableDistritoInDestino(destinoRaw) : false;
                      const showManualRed = Boolean(manualDistTrim) && !detectedInText;
                      const canShowMapLink =
                        Boolean(destinoRaw) && zoneKey !== ZONA_KEYS.SIN_CLASIFICAR;
                      const mapSearchQ = canShowMapLink
                        ? buildMapsSearchQuery(row, destinoRaw, getDistritoOverride)
                        : '';
                      return (
                        <td
                          key={col.key}
                          className="px-2 py-1.5 text-[11px] text-black leading-snug align-middle relative"
                          style={{ border: 'none', ...sepCellStyle }}
                          title={
                            needsDistrito
                              ? 'No se detectó distrito en la dirección. Use el ícono ámbar para indicarlo y asignar zona.'
                              : showManualRed
                                ? `Distrito guardado para este destino: ${manualDistTrim}`
                                : undefined
                          }
                        >
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <span className="break-words text-center flex-1 min-w-[6rem]">
                              {v === '' || v == null ? '' : formatDisplayCell(col.key, v)}
                              {showManualRed ? (
                                <span className="text-red-600 font-semibold whitespace-nowrap">
                                  {' '}
                                  ({formatDisplayCell(col.key, manualDistTrim)})
                                </span>
                              ) : null}
                            </span>
                            {needsDistrito || manualDistTrim ? (
                              <span className="relative shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDistritoFormKey((k) => (k === rk ? null : rk));
                                  }}
                                  className="inline-flex items-center justify-center p-0.5 rounded-md bg-amber-50 shadow-sm border border-amber-300 hover:bg-amber-100 transition-colors"
                                  title={
                                    manualDistTrim
                                      ? 'Cambiar distrito indicado manualmente'
                                      : 'Indicar distrito para ubicar en zona'
                                  }
                                  aria-label="Indicar o editar distrito"
                                >
                                  <MapPinned className="w-4 h-4 text-amber-700" strokeWidth={2.2} />
                                </button>
                                {distritoFormKey === rk ? (
                                  <DistritoFormPopover
                                    initialValue={manualDistTrim}
                                    onSave={(dist) => {
                                      setDistritoOverrides((prev) =>
                                        mergeDistritoSave(row, dist, rowsForDistritoMerge, prev)
                                      );
                                    }}
                                    onClose={() => setDistritoFormKey(null)}
                                  />
                                ) : null}
                              </span>
                            ) : null}
                            {canShowMapLink ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMapQuery(mapSearchQ);
                                }}
                                className="inline-flex items-center justify-center p-0.5 rounded-md bg-white/80 shadow-sm border border-red-200/80 hover:bg-red-50 hover:border-red-300 transition-colors shrink-0"
                                title="Ver ubicación en Google Maps"
                                aria-label={`Ver en mapa: ${mapSearchQ}`}
                              >
                                <MapPin className="w-4 h-4 text-red-600" strokeWidth={2.2} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        className="px-2 py-1.5 text-[11px] text-black leading-snug align-middle break-words"
                        style={{ border: 'none', ...sepCellStyle }}
                        title={row[col.key] != null ? String(row[col.key]) : ''}
                      >
                        {v === '' || v == null ? '' : formatDisplayCell(col.key, v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
    {mapQuery ? <MapsModal query={mapQuery} onClose={() => setMapQuery(null)} /> : null}
    </>
  );
}

function LogisticsSheetWithZoneTabs({
  sheet,
  distritoOverrides,
  setDistritoOverrides,
  allLogisticsRows
}) {
  const [activeZone, setActiveZone] = useState(null);
  const [activeEstadoTab, setActiveEstadoTab] = useState(ESTADO_TAB.ALL);

  const getDistritoOverride = useMemo(
    () => (row) => resolveDistritoManual(row, distritoOverrides),
    [distritoOverrides]
  );

  const grupoEstadoCounts = useMemo(() => countRowsByEstadoGroups(sheet.logisticsRows), [
    sheet.logisticsRows
  ]);

  const displayEstadoTab = useMemo(() => {
    if (activeEstadoTab === ESTADO_TAB.EJECUTADO || activeEstadoTab === ESTADO_TAB.RECHAZADO) {
      return activeEstadoTab;
    }
    return ESTADO_TAB.ALL;
  }, [activeEstadoTab]);

  /** Base de zonas: solo autorizados (regla principal). */
  const rowsAutorizados = useMemo(
    () => filterRowsByEstadoTab(sheet.logisticsRows, ESTADO_TAB.ALL),
    [sheet.logisticsRows]
  );

  /** En pestañas Ejecutado/Rechazado mostramos únicamente ese estado, sin distrito. */
  const rowsEstadoEspecial = useMemo(() => {
    if (displayEstadoTab === ESTADO_TAB.EJECUTADO || displayEstadoTab === ESTADO_TAB.RECHAZADO) {
      return filterRowsByEstadoTab(sheet.logisticsRows, displayEstadoTab);
    }
    return rowsAutorizados;
  }, [sheet.logisticsRows, displayEstadoTab, rowsAutorizados]);

  const sheetFiltrado = useMemo(() => ({ ...sheet, logisticsRows: rowsEstadoEspecial }), [
    sheet,
    rowsEstadoEspecial
  ]);

  const counts = useMemo(() => countRowsByZone(rowsAutorizados, getDistritoOverride), [
    rowsAutorizados,
    getDistritoOverride
  ]);

  const zoneTabs = useMemo(() => zonesWithData(counts), [counts]);

  const displayZone = useMemo(() => {
    if (!zoneTabs.length) return null;
    if (activeZone != null && zoneTabs.includes(activeZone)) return activeZone;
    return zoneTabs[0];
  }, [zoneTabs, activeZone]);

  const vistaLecturaSoloEstado =
    displayEstadoTab === ESTADO_TAB.EJECUTADO || displayEstadoTab === ESTADO_TAB.RECHAZADO;

  if (sheet.logisticsRows.length === 0) {
    return (
      <LogisticsTable
        sheet={sheet}
        activeZone={null}
        distritoOverrides={distritoOverrides}
        setDistritoOverrides={setDistritoOverrides}
        allLogisticsRows={allLogisticsRows}
      />
    );
  }

  return (
    <div className="w-full">
      {/*
        top-16: bajo la barra sticky de "Cargar otro archivo" (App.jsx).
        z-[28]: por debajo del uploader (z-30), por encima de la tabla.
      */}
      <div className="sticky top-16 z-[28] -mx-6 px-6 py-3 mb-3 bg-gray-50/98 backdrop-blur-md border-b border-gray-200 shadow-md space-y-2.5">
        <p className="text-[11px] text-gray-600 leading-snug">
          En pestañas de <strong>distrito/zona</strong> (incluyendo <strong>Sin clasificar</strong>) solo se
          muestran pedidos con estado <strong>Autorizado</strong>. Si una dirección no tiene distrito, puede
          colocarlo con la chincheta para que pase a su zona correspondiente. Las pestañas{' '}
          <strong>Ejecutado</strong> y <strong>Rechazado</strong> ignoran distrito/provincia/callao y muestran
          solo sus registros en tabla de lectura (fecha, vendedor, cliente, producto, cantidad, atendido,
          pendiente, destino, estado).
        </p>
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-2 pt-2"
          role="tablist"
          aria-label="Zona y estado"
        >
          {zoneTabs.map((z) => {
            const accent = ZONE_ACCENT[z] ?? '#64748b';
            const active = displayZone === z;
            return (
              <button
                key={z}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setActiveZone(z);
                  setActiveEstadoTab(ESTADO_TAB.ALL);
                }}
                className={`px-2.5 py-1.5 text-[11px] rounded border transition-colors ${
                  active
                    ? 'bg-white font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200'
                    : 'bg-white/80 text-gray-700 hover:bg-white border-gray-300'
                }`}
                style={{
                  borderLeftWidth: '3px',
                  borderLeftColor: active ? accent : '#e5e7eb'
                }}
              >
                {ZONA_TAB_LABEL[z] ?? z}
                <span className={`ml-1 tabular-nums ${active ? 'text-primary-700' : 'text-gray-500'}`}>
                  ({counts[z]})
                </span>
              </button>
            );
          })}
          {zoneTabs.length > 0 && ESTADO_FILTROS_EN_BARRA.length > 0 ? (
            <span
              className="hidden sm:inline-block w-px h-6 bg-gray-300 shrink-0 mx-0.5 self-center"
              aria-hidden
            />
          ) : null}
          {ESTADO_FILTROS_EN_BARRA.map((ek) => {
            const accent = ESTADO_TAB_ACCENT[ek] ?? '#64748b';
            const active = displayEstadoTab === ek;
            const n = grupoEstadoCounts[ek] ?? 0;
            return (
              <button
                key={ek}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveEstadoTab(ek)}
                className={`px-2.5 py-1.5 text-[11px] rounded border transition-colors ${
                  active
                    ? 'bg-white font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200'
                    : 'bg-white/80 text-gray-700 hover:bg-white border-gray-300'
                }`}
                style={{
                  borderLeftWidth: '3px',
                  borderLeftColor: active ? accent : '#e5e7eb'
                }}
              >
                {ESTADO_TAB_LABEL[ek] ?? ek}
                <span className={`ml-1 tabular-nums ${active ? 'text-primary-700' : 'text-gray-500'}`}>
                  ({n.toLocaleString()})
                </span>
              </button>
            );
          })}
        </div>
        {!vistaLecturaSoloEstado &&
        displayZone === ZONA_KEYS.SIN_CLASIFICAR &&
        counts[ZONA_KEYS.SIN_CLASIFICAR] > 0 ? (
          <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-snug">
            Use el ícono de chincheta en <strong>Destino</strong> para escribir el distrito. Si lo reconocemos,
            el registro saldrá de aquí y se mostrará en la pestaña de la zona correspondiente. Mismo texto de
            destino en varias filas: un solo distrito manual aplica a todas.
          </div>
        ) : null}
      </div>

      <LogisticsTable
        sheet={sheetFiltrado}
        activeZone={displayZone}
        distritoOverrides={distritoOverrides}
        setDistritoOverrides={setDistritoOverrides}
        allLogisticsRows={allLogisticsRows}
        stickyTableHead={false}
        vistaLecturaSoloEstado={vistaLecturaSoloEstado}
        emptyBecauseEstadoFilter={
          sheet.logisticsRows.length > 0 &&
          rowsEstadoEspecial.length === 0 &&
          displayEstadoTab !== ESTADO_TAB.ALL
        }
        onClearEstadoFilter={() => setActiveEstadoTab(ESTADO_TAB.ALL)}
      />
    </div>
  );
}

function AnalysisResults({ data }) {
  const summary = data.analysis.summary;
  const sheets = data.analysis.sheets;
  const sheetsForTable = useMemo(() => sheets.map(normalizePedidoLogisticsSheet), [sheets]);
  const hasMissing = useMemo(
    () => sheets.some((s) => s.missingColumns?.length > 0),
    [sheets]
  );

  /** Memoria global (navegador): distritos por destino normalizado, entre archivos y sesiones. */
  const [distritoOverrides, setDistritoOverrides] = useState(loadDistritoOverridesFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem(DISTRITO_OVERRIDES_STORAGE_KEY, JSON.stringify(distritoOverrides));
    } catch {
      /* ignore */
    }
  }, [distritoOverrides]);

  const allLogisticsRows = useMemo(
    () => sheetsForTable.flatMap((s) => s.logisticsRows || []),
    [sheetsForTable]
  );

  /** Cada nuevo resultado del servidor (incluso mismo nombre de archivo): releer memoria en disco. */
  useEffect(() => {
    setDistritoOverrides(loadDistritoOverridesFromStorage());
  }, [data]);

  return (
    <div className="w-full space-y-4">
      {hasMissing && (
        <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="text-red-900">
            <p className="font-semibold">Faltan columnas en alguna hoja</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {sheets.map((s, i) =>
                s.missingColumns?.length ? (
                  <li key={i}>
                    <strong>{s.name}:</strong> {s.missingColumns.join(', ')}
                  </li>
                ) : null
              )}
            </ul>
          </div>
        </div>
      )}

      <div
        className="text-xs text-gray-600 px-1 flex flex-wrap gap-x-4 gap-y-1"
        title={data.filename}
      >
        <span>
          <span className="font-semibold text-gray-700">Archivo:</span> {data.filename}
        </span>
        <span>
          {summary.totalRowsFiltered.toLocaleString()} filas · {summary.totalSheets}{' '}
          {summary.totalSheets === 1 ? 'hoja' : 'hojas'}
        </span>
      </div>

      <div className="space-y-10">
        {sheetsForTable.map((sheet, sheetIndex) => (
          <section key={sheetIndex} className="w-full">
            {sheetsForTable.length > 1 && (
              <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                {sheet.name}
                <span className="font-normal text-gray-500 normal-case ml-2">
                  ({sheet.totalRowsFiltered.toLocaleString()} filas)
                </span>
              </h3>
            )}
            <LogisticsSheetWithZoneTabs
              sheet={sheet}
              distritoOverrides={distritoOverrides}
              setDistritoOverrides={setDistritoOverrides}
              allLogisticsRows={allLogisticsRows}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

export default AnalysisResults;
