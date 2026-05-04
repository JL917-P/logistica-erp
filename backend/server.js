import express from 'express';
import cors from 'cors';
import multer from 'multer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const distPath = path.join(__dirname, '../frontend/dist');
const distIndex = path.join(distPath, 'index.html');
const serveSpa = fs.existsSync(distIndex);

/** Detrás del proxy TLS de Render / PaaS */
app.set('trust proxy', 1);

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const uploadLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_UPLOAD_MAX) || 40,
  message: {
    success: false,
    error:
      'Demasiadas subidas desde esta dirección. Espere unos minutos e intente de nuevo.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/** Errores de validación de entrada → 400 (no mezclar con fallos de análisis Excel). */
class ClientValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ClientValidationError';
  }
}

// Configurar multer para almacenar archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ClientValidationError('Solo se permiten archivos Excel (.xlsx, .xls) o CSV'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB límite
});

/**
 * Valida contenido por firma (no solo MIME del cliente).
 * — .xlsx: ZIP PK + marca típica de Office Open XML (xl/).
 * — .xls: cabecera OLE Compound Document.
 * — CSV: sin bytes nulos en el muestreo (texto).
 */
function validateSpreadsheetBuffer(buffer) {
  if (!buffer || !(buffer instanceof Buffer) || buffer.length < 4) {
    throw new ClientValidationError('Archivo vacío o demasiado pequeño');
  }
  const head = buffer.subarray(0, 8);
  const isZip =
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07);
  const isOle =
    head[0] === 0xd0 &&
    head[1] === 0xcf &&
    head[2] === 0x11 &&
    head[3] === 0xe0 &&
    head[4] === 0xa1 &&
    head[5] === 0xb1 &&
    head[6] === 0x1a &&
    head[7] === 0xe1;

  if (isZip) {
    const probe = buffer.subarray(0, Math.min(buffer.length, 65536));
    const latin1 = probe.toString('latin1');
    if (!latin1.includes('xl/') && !latin1.includes('xl\\')) {
      throw new ClientValidationError(
        'El archivo ZIP no tiene estructura de Excel (.xlsx). Use un libro válido de Office Open XML.'
      );
    }
    return 'xlsx';
  }
  if (isOle) {
    return 'xls';
  }
  const sampleLen = Math.min(buffer.length, 8192);
  const sample = buffer.subarray(0, sampleLen);
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      throw new ClientValidationError(
        'Formato no reconocido. Use .xlsx, .xls o un archivo CSV de texto plano.'
      );
    }
  }
  try {
    sample.toString('utf8');
  } catch {
    throw new ClientValidationError('CSV: codificación no válida');
  }
  return 'csv';
}

/** Columnas de logística a extraer (el encabezado en Excel debe coincidir al normalizar). */
const LOGISTICS_KEYS = ['centro', 'fecha', 'vendedor', 'cliente', 'producto', 'cantidad', 'destino', 'estado'];

const LOGISTICS_LABELS = {
  centro: 'Centro',
  fecha: 'Fecha',
  vendedor: 'Vendedor',
  cliente: 'Cliente',
  producto: 'Producto',
  cantidad: 'Cantidad',
  destino: 'Destino',
  estado: 'Estado'
};

/** Estados que se muestran (comparación insensible a mayúsculas y espacios). */
const ALLOWED_ESTADOS = new Set(['autorizado', 'atendido parcialmente']);

function normalizeHeader(value) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/^\ufeff/, '')
    .replace(/\u00a0/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeEstadoValue(value) {
  if (value == null || value === '') return '';
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isAllowedEstado(value) {
  return ALLOWED_ESTADOS.has(normalizeEstadoValue(value));
}

function mapLogisticsColumns(headers) {
  const mapping = {};
  const missing = [];
  for (const key of LOGISTICS_KEYS) {
    const idx = headers.findIndex((h) => normalizeHeader(h) === key);
    if (idx === -1) {
      missing.push(key);
      mapping[key] = null;
    } else {
      mapping[key] = {
        index: idx,
        label: headers[idx] ? String(headers[idx]) : LOGISTICS_LABELS[key]
      };
    }
  }
  return { mapping, missing };
}

function rowToLogisticsObject(row, mapping) {
  const obj = {};
  for (const key of LOGISTICS_KEYS) {
    const m = mapping[key];
    obj[key] = m != null && row[m.index] !== undefined && row[m.index] !== null
      ? row[m.index]
      : '';
  }
  return obj;
}

function columnStatsFromRows(rows, key, label) {
  const values = rows.map((r) => r[key]).filter((v) => v !== '' && v != null);
  const sample = values.slice(0, 5).map((v) => String(v));
  const numericVals = values.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
  return {
    key,
    name: label,
    totalValues: values.length,
    uniqueValues: new Set(values.map((v) => String(v))).size,
    sampleValues: sample,
    statistics:
      numericVals.length > 0
        ? {
            min: Math.min(...numericVals),
            max: Math.max(...numericVals),
            avg: numericVals.reduce((a, b) => a + b, 0) / numericVals.length
          }
        : null
  };
}

const MAKRO_REQUIRED_KEYS = [
  'nro_oc',
  'nom_local_entrega',
  'descripcion_producto',
  'unds',
  'peso',
  'sc50',
  'ph'
];

const MAKRO_KEY_ALIASES = {
  nro_oc: ['nro_oc'],
  nom_local_entrega: ['nom_local_entrega'],
  descripcion_producto: ['descripcion_producto'],
  unds: ['unds', 'unidades_solicitadas', 'unidades_en_despacho', 'unidades_recepcionadas'],
  peso: ['peso'],
  sc50: ['sc50'],
  ph: ['ph']
};

function normalizeMakroKey(value) {
  return normalizeHeader(value).replace(/\s+/g, '_');
}

function toNumber(value) {
  if (value === '' || value == null) return 0;
  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isNaN(n) ? 0 : n;
}

function addSums(target, row) {
  target.UNDS += toNumber(row.unds);
  target.PESO += toNumber(row.peso);
  target.SC50 += toNumber(row.sc50);
  target.PH += toNumber(row.ph);
}

function sumsObject() {
  return { UNDS: 0, PESO: 0, SC50: 0, PH: 0 };
}

function mapMakroColumns(headers) {
  const mapping = {};
  const missing = [];
  for (const key of MAKRO_REQUIRED_KEYS) {
    const aliases = MAKRO_KEY_ALIASES[key] || [key];
    const idx = headers.findIndex((h) => aliases.includes(normalizeMakroKey(h)));
    if (idx === -1) {
      missing.push(key);
      mapping[key] = null;
    } else {
      mapping[key] = idx;
    }
  }
  return { mapping, missing };
}

function normalizeProductKey(value) {
  return normalizeHeader(value).replace(/[^a-z0-9]/g, '');
}

function inferUnitWeightFromName(product) {
  const text = String(product || '');
  const m1 = text.match(/x[\s-]?(\d+(?:[.,]\d+)?)\s*kg/i);
  if (m1) {
    return toNumber(m1[1]);
  }
  const m2 = text.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (m2) {
    return toNumber(m2[1]);
  }
  return 0;
}

function mapMakroPivotColumns(headers) {
  const normalized = headers.map((h) => normalizeHeader(h));
  const idxLabel = normalized.findIndex((h) => h === 'etiquetas de fila');
  const idxUnds = normalized.findIndex((h) => h.includes('suma de unds'));
  const idxPeso = normalized.findIndex((h) => h.includes('suma de peso'));
  const idxSc50 = normalized.findIndex((h) => h.includes('suma de sc50'));
  const idxPh = normalized.findIndex((h) => h.includes('suma de ph'));

  if (idxLabel === -1 || idxUnds === -1 || idxPeso === -1 || idxSc50 === -1 || idxPh === -1) {
    return null;
  }

  return { idxLabel, idxUnds, idxPeso, idxSc50, idxPh };
}

function mapMakroHoja4Columns(headers) {
  const normalized = headers.map((h) => normalizeHeader(h));
  const idxLabel = normalized.findIndex((h) => h === 'etiquetas de fila');
  const idxUnds = normalized.findIndex((h) => h.includes('suma de unds'));
  const idxSc50 = normalized.findIndex((h) => h.includes('suma de sc50'));
  const idxPh = normalized.findIndex((h) => h.includes('suma de ph'));
  const idxPeso = normalized.findIndex((h) => h.includes('suma de peso'));

  if (idxLabel === -1 || idxUnds === -1 || idxSc50 === -1 || idxPh === -1) {
    return null;
  }
  return { idxLabel, idxUnds, idxSc50, idxPh, idxPeso };
}

function parseMakroPivotRows(dataRows, cols) {
  const groups = [];
  let currentStore = null;
  let currentOrder = null;

  const nextNonEmptyLabel = (startIdx) => {
    for (let i = startIdx + 1; i < dataRows.length; i++) {
      const candidate = String(dataRows[i][cols.idxLabel] ?? '').trim();
      if (candidate) return candidate;
    }
    return '';
  };

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    const label = String(row[cols.idxLabel] ?? '').trim();
    if (!label) continue;

    const sums = {
      UNDS: toNumber(row[cols.idxUnds]),
      PESO: toNumber(row[cols.idxPeso]),
      SC50: toNumber(row[cols.idxSc50]),
      PH: toNumber(row[cols.idxPh])
    };

    const labelNorm = normalizeHeader(label);
    const nextLabel = nextNonEmptyLabel(rowIdx);
    const looksLikeStoreByContext = /^\d+$/.test(nextLabel);
    const isStoreRow = labelNorm.startsWith('makro ') || looksLikeStoreByContext;

    if (isStoreRow && labelNorm !== 'total general') {
      currentStore = {
        store: label,
        sums,
        orders: []
      };
      groups.push(currentStore);
      currentOrder = null;
      continue;
    }

    if (/^\d+$/.test(label)) {
      if (!currentStore) continue;
      currentOrder = {
        orderId: label,
        sums,
        products: []
      };
      currentStore.orders.push(currentOrder);
      continue;
    }

    if (currentOrder) {
      currentOrder.products.push({
        name: label,
        sums
      });
    }
  }

  const totalOrders = groups.reduce((acc, store) => acc + store.orders.length, 0);
  return {
    summary: {
      totalRowsSource: dataRows.length,
      totalRowsProcessed: dataRows.length,
      totalStores: groups.length,
      totalOrders
    },
    missingColumns: [],
    groups
  };
}

function extractMakroHoja4(workbook) {
  const candidateSheetNames = ['Hoja4', 'hoja4'];
  const orderedNames = [
    ...candidateSheetNames.filter((n) => workbook.SheetNames.includes(n)),
    ...workbook.SheetNames.filter((n) => !candidateSheetNames.includes(n))
  ];

  for (const sheetName of orderedNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawJsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false
    });
    const jsonData = splitSemicolonMatrixIfNeeded(rawJsonData);

    let headerRow = 0;
    for (let i = 0; i < jsonData.length; i++) {
      if (jsonData[i].some((cell) => cell !== '')) {
        headerRow = i;
        break;
      }
    }

    const headers = (jsonData[headerRow] || []).map((h) => (h == null ? '' : h));
    const cols = mapMakroHoja4Columns(headers);
    if (!cols) continue;

    const dataRows = jsonData
      .slice(headerRow + 1)
      .filter((row) => row.some((cell) => cell !== ''))
      .map((row) => ({
        producto: String(row[cols.idxLabel] ?? '').trim(),
        unds: toNumber(row[cols.idxUnds]),
        peso: cols.idxPeso >= 0 ? toNumber(row[cols.idxPeso]) : 0,
        sc50: toNumber(row[cols.idxSc50]),
        ph: toNumber(row[cols.idxPh])
      }))
      .filter((r) => r.producto !== '' && normalizeHeader(r.producto) !== 'total general');

    const totals = dataRows.reduce(
      (acc, r) => {
        acc.unds += r.unds;
        acc.peso += r.peso;
        acc.sc50 += r.sc50;
        acc.ph += r.ph;
        return acc;
      },
      { unds: 0, peso: 0, sc50: 0, ph: 0 }
    );

    return {
      sheetName,
      rows: dataRows,
      totals
    };
  }

  return {
    sheetName: null,
    rows: [],
    totals: { unds: 0, peso: 0, sc50: 0, ph: 0 }
  };
}

function extractMakroHoja1(workbook) {
  const candidateSheetNames = ['Hoja1', 'hoja1'];
  const orderedNames = [
    ...candidateSheetNames.filter((n) => workbook.SheetNames.includes(n)),
    ...workbook.SheetNames.filter((n) => !candidateSheetNames.includes(n))
  ];

  for (const sheetName of orderedNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawJsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false
    });
    const jsonData = splitSemicolonMatrixIfNeeded(rawJsonData);

    let headerRow = 0;
    for (let i = 0; i < jsonData.length; i++) {
      if (jsonData[i].some((cell) => cell !== '')) {
        headerRow = i;
        break;
      }
    }

    const headers = (jsonData[headerRow] || []).map((h) => (h == null ? '' : h));
    const normalized = headers.map((h) => normalizeHeader(h));
    const idxProducto = normalized.findIndex((h) => h.includes('descripcion_producto'));
    const idxPeso = normalized.findIndex((h) => h === 'peso');

    if (idxProducto === -1 || idxPeso === -1) continue;

    const rows = jsonData
      .slice(headerRow + 1)
      .filter((row) => row.some((cell) => cell !== ''))
      .map((row) => ({
        producto: String(row[idxProducto] ?? '').trim(),
        peso: toNumber(row[idxPeso])
      }))
      .filter((r) => r.producto !== '');

    return {
      sheetName,
      rows
    };
  }

  return {
    sheetName: null,
    rows: []
  };
}

function buildHoja4FromBaseRows(rows) {
  const byProduct = new Map();
  for (const row of rows) {
    const producto = String(row.descripcion_producto ?? '').trim();
    if (!producto) continue;
    if (!byProduct.has(producto)) {
      byProduct.set(producto, {
        producto,
        unds: 0,
        peso: 0,
        sc50: 0,
        ph: 0
      });
    }
    const acc = byProduct.get(producto);
    acc.unds += toNumber(row.unds);
    acc.peso += toNumber(row.peso);
    acc.sc50 += toNumber(row.sc50);
    acc.ph += toNumber(row.ph);
  }

  const productRows = Array.from(byProduct.values()).sort((a, b) =>
    a.producto.localeCompare(b.producto, 'es')
  );
  const totals = productRows.reduce(
    (acc, r) => {
      acc.unds += r.unds;
      acc.peso += r.peso;
      acc.sc50 += r.sc50;
      acc.ph += r.ph;
      return acc;
    },
    { unds: 0, peso: 0, sc50: 0, ph: 0 }
  );

  return {
    sheetName: 'Generada desde ordenes',
    rows: productRows,
    totals
  };
}

function buildHoja1FromBaseRows(rows) {
  const byProduct = new Map();
  for (const row of rows) {
    const producto = String(row.descripcion_producto ?? '').trim();
    if (!producto) continue;
    if (!byProduct.has(producto)) {
      byProduct.set(producto, []);
    }
    byProduct.get(producto).push(toNumber(row.peso));
  }

  const result = Array.from(byProduct.entries())
    .map(([producto, pesos]) => {
      // Usa el peso más frecuente (moda) para aproximar el catálogo base.
      const freq = new Map();
      for (const p of pesos) {
        const key = String(p);
        freq.set(key, (freq.get(key) || 0) + 1);
      }
      let bestPeso = pesos[0] || 0;
      let bestCount = -1;
      for (const [k, count] of freq.entries()) {
        if (count > bestCount) {
          bestCount = count;
          bestPeso = Number(k);
        }
      }
      return { producto, peso: bestPeso };
    })
    .sort((a, b) => a.producto.localeCompare(b.producto, 'es'));

  return {
    sheetName: 'Generada desde ordenes',
    rows: result
  };
}

function splitSemicolonMatrixIfNeeded(rows) {
  const hasMostlySingleColumn = rows.length > 0 && rows.every((r) => (r?.length || 0) <= 1);
  if (!hasMostlySingleColumn) return rows;

  const delimiters = [';', '\t', ','];
  const best = delimiters
    .map((d) => ({
      d,
      hits: rows.filter((r) => String(r?.[0] ?? '').includes(d)).length
    }))
    .sort((a, b) => b.hits - a.hits)[0];

  if (!best || best.hits === 0) return rows;
  return rows.map((r) => String(r?.[0] ?? '').split(best.d).map((part) => part.trim()));
}

function analyzeMakroExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let hoja4 = extractMakroHoja4(workbook);
    let hoja1 = extractMakroHoja1(workbook);
    let bestMissing = MAKRO_REQUIRED_KEYS;
    let bestRowsCount = 0;
    let rows = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rawJsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false
      });
      const jsonData = splitSemicolonMatrixIfNeeded(rawJsonData);

      let headerRow = 0;
      for (let i = 0; i < jsonData.length; i++) {
        if (jsonData[i].some((cell) => cell !== '')) {
          headerRow = i;
          break;
        }
      }

      const headers = (jsonData[headerRow] || []).map((h) => (h == null ? '' : h));
      const dataRows = jsonData.slice(headerRow + 1).filter((row) => row.some((cell) => cell !== ''));

      const pivotCols = mapMakroPivotColumns(headers);
      if (pivotCols) {
        const pivotAnalysis = parseMakroPivotRows(dataRows, pivotCols);
        return {
          ...pivotAnalysis,
          hoja4,
          hoja1,
          baseRows: []
        };
      }

      const { mapping, missing } = mapMakroColumns(headers);
      const minimumMissing = ['nro_oc', 'nom_local_entrega', 'descripcion_producto', 'unds'].filter(
        (k) => mapping[k] == null
      );
      if (
        minimumMissing.length < bestMissing.length ||
        (minimumMissing.length === bestMissing.length && dataRows.length > bestRowsCount)
      ) {
        bestMissing = minimumMissing;
        bestRowsCount = dataRows.length;
      }

      if (minimumMissing.length === 0) {
        rows = dataRows.map((row) => ({
          nro_oc: row[mapping.nro_oc] ?? '',
          nom_local_entrega: row[mapping.nom_local_entrega] ?? '',
          descripcion_producto: row[mapping.descripcion_producto] ?? '',
          unds: row[mapping.unds] ?? 0,
          peso: mapping.peso != null ? row[mapping.peso] : '',
          sc50: mapping.sc50 != null ? row[mapping.sc50] : '',
          ph: mapping.ph != null ? row[mapping.ph] : ''
        }));
        break;
      }
    }

    if (rows.length === 0) {
      return {
        summary: { totalRowsSource: bestRowsCount, totalStores: 0, totalOrders: 0 },
        missingColumns: bestMissing,
        groups: [],
        hoja4,
        hoja1
      };
    }

    const filteredRows = rows.filter(
      (r) =>
        String(r.nro_oc).trim() !== '' &&
        String(r.nom_local_entrega).trim() !== '' &&
        String(r.descripcion_producto).trim() !== ''
    );

    const productWeightMap = new Map();
    if (hoja1.rows.length > 0) {
      for (const item of hoja1.rows) {
        productWeightMap.set(normalizeProductKey(item.producto), toNumber(item.peso));
      }
    }

    const enrichedRows = filteredRows.map((r) => {
      const unds = toNumber(r.unds);
      const productKey = normalizeProductKey(r.descripcion_producto);
      const mappedWeight = productWeightMap.get(productKey) || 0;
      const inferredWeight = inferUnitWeightFromName(r.descripcion_producto);
      const unitWeight = mappedWeight || inferredWeight || 0;

      const peso = r.peso !== '' && r.peso != null ? toNumber(r.peso) : unds * unitWeight;
      const sc50 = r.sc50 !== '' && r.sc50 != null ? toNumber(r.sc50) : peso / 50;
      const ph = r.ph !== '' && r.ph != null ? toNumber(r.ph) : sc50 / 18;

      return {
        ...r,
        unds,
        peso,
        sc50,
        ph
      };
    });

    if (!hoja4.rows.length) {
      hoja4 = buildHoja4FromBaseRows(enrichedRows);
    }
    if (!hoja1.rows.length) {
      hoja1 = buildHoja1FromBaseRows(enrichedRows);
    }

    const storeMap = new Map();
    for (const row of enrichedRows) {
      const storeKey = String(row.nom_local_entrega).trim();
      const orderKey = String(row.nro_oc).trim();
      const productKey = String(row.descripcion_producto).trim();

      if (!storeMap.has(storeKey)) {
        storeMap.set(storeKey, { store: storeKey, sums: sumsObject(), orders: new Map() });
      }
      const store = storeMap.get(storeKey);
      addSums(store.sums, row);

      if (!store.orders.has(orderKey)) {
        store.orders.set(orderKey, { orderId: orderKey, sums: sumsObject(), products: new Map() });
      }
      const order = store.orders.get(orderKey);
      addSums(order.sums, row);

      if (!order.products.has(productKey)) {
        order.products.set(productKey, { name: productKey, sums: sumsObject() });
      }
      addSums(order.products.get(productKey).sums, row);
    }

    const groups = Array.from(storeMap.values())
      .sort((a, b) => a.store.localeCompare(b.store, 'es'))
      .map((store) => ({
        store: store.store,
        sums: store.sums,
        orders: Array.from(store.orders.values())
          .sort((a, b) => a.orderId.localeCompare(b.orderId, 'es'))
          .map((order) => ({
            orderId: order.orderId,
            sums: order.sums,
            products: Array.from(order.products.values()).sort((a, b) =>
              a.name.localeCompare(b.name, 'es')
            )
          }))
      }));

    const totalOrders = groups.reduce((acc, store) => acc + store.orders.length, 0);

    return {
      summary: {
        totalRowsSource: rows.length,
        totalRowsProcessed: enrichedRows.length,
        totalStores: groups.length,
        totalOrders
      },
      missingColumns: [],
      groups,
      hoja4,
      hoja1,
      baseRows: enrichedRows.map((r) => ({
        nro_oc: r.nro_oc,
        nom_local_entrega: r.nom_local_entrega,
        descripcion_producto: r.descripcion_producto,
        unds: r.unds
      }))
    };
  } catch (error) {
    throw new Error(`Error al procesar el archivo Makro: ${error.message}`);
  }
}

// Función para analizar el archivo Excel (solo columnas logísticas y filtro por estado)
function analyzeExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const results = {
      sheets: [],
      summary: {
        totalSheets: workbook.SheetNames.length,
        totalRowsSource: 0,
        totalRowsFiltered: 0,
        totalColumns: LOGISTICS_KEYS.length,
        estadoFilterLabels: ['Autorizado', 'Atendido parcialmente']
      }
    };

    workbook.SheetNames.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false
      });

      let headerRow = 0;
      for (let i = 0; i < jsonData.length; i++) {
        if (jsonData[i].some((cell) => cell !== '')) {
          headerRow = i;
          break;
        }
      }

      const headers = (jsonData[headerRow] || []).map((h) => (h === undefined || h === null ? '' : h));
      const dataRows = jsonData.slice(headerRow + 1).filter((row) => row.some((cell) => cell !== ''));

      const { mapping, missing } = mapLogisticsColumns(headers);

      const allLogisticsRows = dataRows.map((row) => rowToLogisticsObject(row, mapping));
      const filteredRows = allLogisticsRows.filter((r) => isAllowedEstado(r.estado));

      const columns = LOGISTICS_KEYS.map((key) =>
        columnStatsFromRows(filteredRows, key, mapping[key]?.label || LOGISTICS_LABELS[key])
      );

      const sheetInfo = {
        name: sheetName,
        index,
        totalRowsSource: dataRows.length,
        totalRowsFiltered: filteredRows.length,
        missingColumns: missing,
        columns,
        logisticsRows: filteredRows
      };

      results.sheets.push(sheetInfo);
      results.summary.totalRowsSource += dataRows.length;
      results.summary.totalRowsFiltered += filteredRows.length;
    });

    return results;
  } catch (error) {
    throw new Error(`Error al procesar el archivo Excel: ${error.message}`);
  }
}

// Ruta para subir y analizar archivo
app.post('/api/upload', uploadLimiter, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    validateSpreadsheetBuffer(req.file.buffer);

    const analysis = analyzeExcel(req.file.buffer);
    res.json({
      success: true,
      filename: req.file.originalname,
      analysis: analysis
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/upload-makro', uploadLimiter, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    validateSpreadsheetBuffer(req.file.buffer);

    const analysis = analyzeMakroExcel(req.file.buffer);
    res.json({
      success: true,
      filename: req.file.originalname,
      analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
});

// Frontend compilado (Vite → dist); en desarrollo sin build no se monta
if (serveSpa) {
  app.use(express.static(distPath, { index: false }));
}

/**
 * Fallback SPA: entregar index.html para cualquier GET que no sea API ni archivo estático.
 * Las rutas POST /api/* ya están definidas arriba.
 */
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }
  if (!serveSpa) {
    return res.status(404).send(
      'Servidor API en modo desarrollo. Ejecute el build del frontend (npm run build en /frontend) o use Vite con proxy.'
    );
  }
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  res.sendFile(distIndex, (err) => {
    if (err) next(err);
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'El archivo supera el tamaño máximo permitido (10 MB).'
      });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  const msg = err?.message || '';
  if (err instanceof ClientValidationError || err?.name === 'ClientValidationError') {
    return res.status(400).json({ success: false, error: msg });
  }
  if (msg.includes('Solo se permiten archivos Excel')) {
    return res.status(400).json({ success: false, error: msg });
  }
  console.error(err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : msg || 'Error interno'
  });
});

const host = '0.0.0.0';
app.listen(PORT, host, () => {
  console.log(`Servidor escuchando en el puerto ${PORT} (${serveSpa ? 'API + SPA estático' : 'solo API'})`);
});
