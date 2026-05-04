import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import FileUploader from './FileUploader';

function num(value) {
  return Number(value || 0);
}

function fmt(value) {
  return num(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const DEFAULT_PRODUCT_WEIGHTS = [
  { producto: 'GRAN-CHALAN-ARROZ-EXTRA-BL-5KG', peso: 5 },
  { producto: 'GRAN-CHALAN-ARROZ-SUPERIOR-BL-5KG', peso: 5 },
  { producto: 'ARROZ-SUPERIOR-ARO-NIR-X5KG', peso: 5 },
  { producto: 'ARROZ-DESPUNTADO-ARO-NIR-X10KG', peso: 12 },
  { producto: 'ARROZ-DESPUNTADO-ARO-NIR-X49KG', peso: 49 },
  { producto: 'ARROZ-SUPERIOR-ARO-NIR-X49KG', peso: 49 },
  { producto: 'ARROZ-SUPERIOR-CUSI-CUSA-X49KG', peso: 49 },
  { producto: 'ARROZ-EXT-ANEJO-GRAN-CHALAN-X50KG', peso: 50 },
  { producto: 'ARROZ-FAMILIAR-MI-CHACRITA-X49KG', peso: 49 },
  { producto: 'ARROZ-GRAN-CHALAN-EXT-ANEJO-X5KG', peso: 5 },
  { producto: 'GRAN-CHALAN-EXTRA-NEGRO-SC-X-10-KG', peso: 10 },
  { producto: 'GRAN-CHALAN-EXTRA-NEGRO-SC-X-50-KG', peso: 50 },
  { producto: 'ARROZ-EXTRA-ARO-NIR-X50KG', peso: 50 },
  { producto: 'ARROZ-EXTRA-ARO-NIR-X5KG', peso: 5 },
  { producto: 'ARROZ-SUPERIOR-CUSI-CUSA-SC-10-KG', peso: 10 },
  { producto: 'GRAN-CHALAN-GOURMET-EXTRA-ANEJO-X-10-KG', peso: 10 },
  { producto: 'GRAN-CHALAN-GOURMET-EXTRA-ANEJO-X-25-KG', peso: 25 },
  { producto: 'GRAN-CHALAN-GOURMET-EXTRA-ANEJO-SC-X-50', peso: 50 }
];
const MAKRO_CATALOG_STORAGE_KEY = 'makro_productos_pesos_confirmados_v1';
const ROW_BG_HOVER = '#dff3ff';
/** Scroll interno casi a pantalla completa (metadatos + pestañas ya consumen espacio arriba) */
const MAKRO_SCROLL_MAIN =
  'w-full h-[calc(100dvh-8.75rem)] min-h-[280px] overflow-auto border border-[#c6d4e6] rounded-sm bg-white';
/** Con línea “Fuente” encima de la tabla */
const MAKRO_SCROLL_SUBTAB =
  'w-full h-[calc(100dvh-10.25rem)] min-h-[260px] overflow-auto border border-[#c6d4e6] rounded-sm bg-white';
/** Productos/Pesos: formulario de alta + tabla */
const MAKRO_SCROLL_FORM_TAB =
  'w-full h-[calc(100dvh-13.5rem)] min-h-[240px] overflow-auto border border-[#c6d4e6] rounded-sm bg-white';

function normalizeProductKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function inferUnitWeightFromName(product) {
  const text = String(product || '');
  const m1 = text.match(/x[\s-]?(\d+(?:[.,]\d+)?)\s*kg/i);
  if (m1) return num(String(m1[1]).replace(',', '.'));
  const m2 = text.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (m2) return num(String(m2[1]).replace(',', '.'));
  return 0;
}

function MakroAnalysisResults({ data, uploadProps }) {
  const analysis = data?.analysis;
  const baseRows = analysis?.baseRows || [];
  const backendGroups = analysis?.groups || [];
  const backendHoja4 = analysis?.hoja4 || {
    rows: [],
    totals: { unds: 0, peso: 0, sc50: 0, ph: 0 },
    sheetName: null
  };
  const hoja1 = analysis?.hoja1 || { rows: [], sheetName: null };
  const backendSummary = analysis?.summary || {};
  const missingColumns = analysis?.missingColumns || [];
  const [activeTab, setActiveTab] = useState('resumen');
  const [hoja1Rows, setHoja1Rows] = useState(() => {
    try {
      const raw = localStorage.getItem(MAKRO_CATALOG_STORAGE_KEY);
      if (!raw) return DEFAULT_PRODUCT_WEIGHTS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_PRODUCT_WEIGHTS;
      const cleaned = parsed
        .map((r) => ({
          producto: String(r?.producto || '').trim(),
          peso: num(r?.peso)
        }))
        .filter((r) => r.producto !== '');
      return cleaned.length ? cleaned : DEFAULT_PRODUCT_WEIGHTS;
    } catch {
      return DEFAULT_PRODUCT_WEIGHTS;
    }
  });
  const [newProducto, setNewProducto] = useState('');
  const [newPeso, setNewPeso] = useState('');

  // Catalogo confirmado: no se modifica automaticamente con nuevos archivos.
  // Solo cambia por acciones manuales del usuario (editar/agregar/eliminar).

  useEffect(() => {
    try {
      localStorage.setItem(MAKRO_CATALOG_STORAGE_KEY, JSON.stringify(hoja1Rows));
    } catch {
      // Ignorar errores de almacenamiento para no interrumpir el flujo.
    }
  }, [hoja1Rows]);

  const computed = useMemo(() => {
    if (!baseRows.length) {
      return {
        groups: backendGroups,
        hoja4: backendHoja4,
        summary: backendSummary
      };
    }

    const weightMap = new Map(
      hoja1Rows.map((r) => [normalizeProductKey(r.producto), num(r.peso)])
    );

    const enriched = baseRows.map((r) => {
      const unds = num(r.unds);
      const mapped = weightMap.get(normalizeProductKey(r.descripcion_producto)) || 0;
      const unitWeight = mapped || inferUnitWeightFromName(r.descripcion_producto);
      const peso = unds * unitWeight;
      const sc50 = peso / 50;
      const ph = sc50 / 18;
      return { ...r, unds, peso, sc50, ph };
    });

    const storeMap = new Map();
    for (const row of enriched) {
      const storeKey = String(row.nom_local_entrega || '').trim();
      const orderKey = String(row.nro_oc || '').trim();
      const productKey = String(row.descripcion_producto || '').trim();
      if (!storeKey || !orderKey || !productKey) continue;

      if (!storeMap.has(storeKey)) {
        storeMap.set(storeKey, { store: storeKey, sums: { UNDS: 0, PESO: 0, SC50: 0, PH: 0 }, orders: new Map() });
      }
      const store = storeMap.get(storeKey);
      store.sums.UNDS += row.unds;
      store.sums.PESO += row.peso;
      store.sums.SC50 += row.sc50;
      store.sums.PH += row.ph;

      if (!store.orders.has(orderKey)) {
        store.orders.set(orderKey, { orderId: orderKey, sums: { UNDS: 0, PESO: 0, SC50: 0, PH: 0 }, products: new Map() });
      }
      const order = store.orders.get(orderKey);
      order.sums.UNDS += row.unds;
      order.sums.PESO += row.peso;
      order.sums.SC50 += row.sc50;
      order.sums.PH += row.ph;

      if (!order.products.has(productKey)) {
        order.products.set(productKey, { name: productKey, sums: { UNDS: 0, PESO: 0, SC50: 0, PH: 0 } });
      }
      const product = order.products.get(productKey);
      product.sums.UNDS += row.unds;
      product.sums.PESO += row.peso;
      product.sums.SC50 += row.sc50;
      product.sums.PH += row.ph;
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
            products: Array.from(order.products.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
          }))
      }));

    const byProduct = new Map();
    for (const row of enriched) {
      const p = String(row.descripcion_producto || '').trim();
      if (!p) continue;
      if (!byProduct.has(p)) byProduct.set(p, { producto: p, unds: 0, sc50: 0, ph: 0 });
      const acc = byProduct.get(p);
      acc.unds += row.unds;
      acc.sc50 += row.sc50;
      acc.ph += row.ph;
    }
    const hoja4Rows = Array.from(byProduct.values()).sort((a, b) =>
      a.producto.localeCompare(b.producto, 'es')
    );
    const hoja4Totals = hoja4Rows.reduce(
      (acc, r) => ({ unds: acc.unds + r.unds, sc50: acc.sc50 + r.sc50, ph: acc.ph + r.ph }),
      { unds: 0, sc50: 0, ph: 0 }
    );

    return {
      groups,
      hoja4: {
        sheetName: backendHoja4?.sheetName || 'Generada desde ordenes',
        rows: hoja4Rows,
        totals: hoja4Totals
      },
      summary: {
        totalStores: groups.length,
        totalOrders: groups.reduce((acc, s) => acc + s.orders.length, 0)
      }
    };
  }, [baseRows, backendGroups, backendHoja4, backendSummary, hoja1Rows]);

  const groups = computed.groups || [];
  const hoja4 = computed.hoja4 || backendHoja4;
  const summary = computed.summary || backendSummary;

  const totalProducts = useMemo(
    () =>
      groups.reduce(
        (acc, store) =>
          acc +
          store.orders.reduce((orderAcc, order) => orderAcc + order.products.length, 0),
        0
      ),
    [groups]
  );

  const resumenTotals = useMemo(
    () =>
      groups.reduce(
        (acc, store) => {
          acc.unds += num(store?.sums?.UNDS);
          acc.peso += num(store?.sums?.PESO);
          acc.sc50 += num(store?.sums?.SC50);
          acc.ph += num(store?.sums?.PH);
          return acc;
        },
        { unds: 0, peso: 0, sc50: 0, ph: 0 }
      ),
    [groups]
  );

  const sacosTotales = useMemo(() => {
    const rows = groups.map((store) => ({
      tienda: store.store,
      nroOc: store.orders?.[0]?.orderId || '',
      sc50: num(store?.sums?.SC50),
      ph: num(store?.sums?.PH)
    }));
    const totals = rows.reduce(
      (acc, r) => {
        acc.sc50 += r.sc50;
        acc.ph += r.ph;
        return acc;
      },
      { sc50: 0, ph: 0 }
    );
    return { rows, totals };
  }, [groups]);

  return (
    <div className="w-full space-y-4">
      {missingColumns.length > 0 && (
        <div className="flex gap-3 p-3 bg-[#fff7d9] border border-[#e2d3a5] rounded text-sm">
          <AlertCircle className="w-4 h-4 text-[#8a6d1d] shrink-0 mt-0.5" />
          <div className="text-[#6f5614]">
            <p className="font-semibold">Columnas faltantes para Makro</p>
            <p className="mt-1">Faltan: {missingColumns.join(', ')}</p>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-600 px-1 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="font-semibold text-gray-700">Archivo:</span> {data.filename}
        </span>
        <span>
          Tiendas: {summary.totalStores || 0} · OCs: {summary.totalOrders || 0} · Productos:{' '}
          {totalProducts}
        </span>
      </div>

      <div className="sticky top-12 z-20 -mx-6 px-6 py-2 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('resumen')}
              className={`px-3 py-1.5 text-xs rounded border ${
                activeTab === 'resumen'
                  ? 'bg-[#dbe5f1] border-[#9eb6ce] text-black font-semibold'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              Resumen Tiendas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hoja4')}
              className={`px-3 py-1.5 text-xs rounded border ${
                activeTab === 'hoja4'
                  ? 'bg-[#dbe5f1] border-[#9eb6ce] text-black font-semibold'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              Descripción Producto
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sacos')}
              className={`px-3 py-1.5 text-xs rounded border ${
                activeTab === 'sacos'
                  ? 'bg-[#dbe5f1] border-[#9eb6ce] text-black font-semibold'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              Sacos Totales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hoja1')}
              className={`px-3 py-1.5 text-xs rounded border ${
                activeTab === 'hoja1'
                  ? 'bg-[#dbe5f1] border-[#9eb6ce] text-black font-semibold'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              Productos/Pesos
            </button>
          </div>
          {uploadProps ? (
            <div className="shrink-0">
              <FileUploader compact {...uploadProps} />
            </div>
          ) : null}
        </div>
      </div>

      {activeTab === 'resumen' && (
      <div className={MAKRO_SCROLL_MAIN}>
        <table className="w-full border-separate border-spacing-0 text-center text-xs">
          <thead>
            <tr className="text-black">
              <th className="sticky top-0 z-20 bg-[#dbe5f1] font-bold text-[12px] px-2 py-1 text-left border-b border-[#b8cce4] shadow-[0_1px_0_#b8cce4]">
                Etiquetas de fila
              </th>
              <th className="sticky top-0 z-20 bg-[#dbe5f1] font-bold text-[12px] px-2 py-1.5 border-b border-[#b8cce4] shadow-[0_1px_0_#b8cce4]">
                Suma de UNDS
              </th>
              <th className="sticky top-0 z-20 bg-[#dbe5f1] font-bold text-[12px] px-2 py-1.5 border-b border-[#b8cce4] shadow-[0_1px_0_#b8cce4]">
                Suma de PESO
              </th>
              <th className="sticky top-0 z-20 bg-[#dbe5f1] font-bold text-[12px] px-2 py-1.5 border-b border-[#b8cce4] shadow-[0_1px_0_#b8cce4]">
                Suma de SC50
              </th>
              <th className="sticky top-0 z-20 bg-[#dbe5f1] font-bold text-[12px] px-2 py-1.5 border-b border-[#b8cce4] shadow-[0_1px_0_#b8cce4]">
                Suma de PH
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr className="bg-white">
                <td colSpan={5} className="px-3 py-4 text-xs text-black text-center">
                  No hay datos para mostrar. Revisa columnas requeridas o contenido del archivo.
                </td>
              </tr>
            ) : (
              <>
                {groups.map((store, storeIdx) => (
                  <Fragment key={`store-frag-${store.store}`}>
                    <tr
                      key={`store-${store.store}`}
                      className="bg-white transition-colors"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = ROW_BG_HOVER;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '';
                      }}
                    >
                      <td
                        className="px-2 py-0.5 text-left font-bold text-[11px]"
                        style={{
                          borderTop: storeIdx > 0 ? '1px solid #6b6f78' : 'none'
                        }}
                      >
                        {store.store}
                      </td>
                      <td
                        className="px-2 py-1.5 font-bold"
                        style={{
                          borderTop: storeIdx > 0 ? '1px solid #6b6f78' : 'none'
                        }}
                      >
                        {fmt(store.sums.UNDS)}
                      </td>
                      <td
                        className="px-2 py-1.5 font-bold"
                        style={{
                          borderTop: storeIdx > 0 ? '1px solid #6b6f78' : 'none'
                        }}
                      >
                        {fmt(store.sums.PESO)}
                      </td>
                      <td
                        className="px-2 py-1.5 font-bold"
                        style={{
                          borderTop: storeIdx > 0 ? '1px solid #6b6f78' : 'none'
                        }}
                      >
                        {fmt(store.sums.SC50)}
                      </td>
                      <td
                        className="px-2 py-1.5 font-bold"
                        style={{
                          borderTop: storeIdx > 0 ? '1px solid #6b6f78' : 'none'
                        }}
                      >
                        {fmt(store.sums.PH)}
                      </td>
                    </tr>
                    {store.orders.map((order) => (
                      <Fragment key={`order-frag-${store.store}-${order.orderId}`}>
                        <tr
                          key={`order-${store.store}-${order.orderId}`}
                          className="bg-white transition-colors"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = ROW_BG_HOVER;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '';
                          }}
                        >
                          <td className="px-2 py-0.5 text-left font-semibold pl-6">{order.orderId}</td>
                          <td className="px-2 py-1.5 font-semibold">{fmt(order.sums.UNDS)}</td>
                          <td className="px-2 py-1.5 font-semibold">{fmt(order.sums.PESO)}</td>
                          <td className="px-2 py-1.5 font-semibold">{fmt(order.sums.SC50)}</td>
                          <td className="px-2 py-1.5 font-semibold">{fmt(order.sums.PH)}</td>
                        </tr>
                        {order.products.map((product) => (
                          <tr
                            key={`prod-${store.store}-${order.orderId}-${product.name}`}
                            className="bg-white transition-colors"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = ROW_BG_HOVER;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '';
                            }}
                          >
                            <td className="px-2 py-0.5 text-left pl-12">{product.name}</td>
                            <td className="px-2 py-0.5">{fmt(product.sums.UNDS)}</td>
                            <td className="px-2 py-0.5">{fmt(product.sums.PESO)}</td>
                            <td className="px-2 py-0.5">{fmt(product.sums.SC50)}</td>
                            <td className="px-2 py-0.5">{fmt(product.sums.PH)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
                <tr className="bg-[#dbe5f1]">
                  <td className="px-2 py-1.5 text-left font-bold text-black border-t-2 border-t-[#8fa3c2] border-b border-b-[#c5d5e6] border-r border-r-[#b8cce4]">
                    Total general
                  </td>
                  <td className="px-2 py-1.5 font-bold text-black text-center border-t-2 border-t-[#8fa3c2] border-b border-b-[#c5d5e6] border-r border-r-[#b8cce4]">
                    {fmt(resumenTotals.unds)}
                  </td>
                  <td className="px-2 py-1.5 font-bold text-black text-center border-t-2 border-t-[#8fa3c2] border-b border-b-[#c5d5e6] border-r border-r-[#b8cce4]">
                    {fmt(resumenTotals.peso)}
                  </td>
                  <td className="px-2 py-1.5 font-bold text-black text-center border-t-2 border-t-[#8fa3c2] border-b border-b-[#c5d5e6] border-r border-r-[#b8cce4]">
                    {fmt(resumenTotals.sc50)}
                  </td>
                  <td className="px-2 py-1.5 font-bold text-black text-center border-t-2 border-t-[#8fa3c2] border-b border-b-[#c5d5e6]">
                    {fmt(resumenTotals.ph)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      )}

      {activeTab === 'hoja4' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">
            Fuente: {hoja4.sheetName || 'No detectada'}
          </div>
          <div className={MAKRO_SCROLL_SUBTAB}>
            <table className="w-full border-collapse text-center text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#dbe5f1] text-black border-b border-[#b8cce4]">
                  <th className="font-bold text-[12px] px-2 py-1 text-left">Descripcion producto</th>
                  <th className="font-bold text-[12px] px-2 py-1">Suma de UNDS</th>
                  <th className="font-bold text-[12px] px-2 py-1">Suma de SC50</th>
                  <th className="font-bold text-[12px] px-2 py-1">Suma de PH</th>
                </tr>
              </thead>
              <tbody>
                {hoja4.rows.length === 0 ? (
                  <tr className="bg-white">
                    <td colSpan={4} className="px-3 py-4 text-xs text-black text-center">
                      No se encontraron datos de Hoja4 en este archivo.
                    </td>
                  </tr>
                ) : (
                  <>
                    {hoja4.rows.map((r) => (
                      <tr
                        key={r.producto}
                        className="bg-white border-t border-[#eef3f8] transition-colors"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = ROW_BG_HOVER;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '';
                        }}
                      >
                        <td className="px-2 py-0.5 text-left">{r.producto}</td>
                        <td className="px-2 py-0.5">{fmt(r.unds)}</td>
                        <td className="px-2 py-0.5">{fmt(r.sc50)}</td>
                        <td className="px-2 py-0.5">{fmt(r.ph)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#dbe5f1]">
                      <td className="px-2 py-1.5 text-left font-bold text-black border-t-2 border-t-[#8fa3c2] border-b border-b-[#c5d5e6] border-r border-r-[#b8cce4]">
                        Total general
                      </td>
                      <td className="px-2 py-1.5 font-bold text-black text-center border-t-2 border-t-[#8fa3c2] border-b border-b-[#c5d5e6] border-r border-r-[#b8cce4]">
                        {fmt(hoja4.totals.unds)}
                      </td>
                      <td className="px-2 py-1.5 font-bold text-black text-center border-t-2 border-t-[#8fa3c2] border-b border-b-[#c5d5e6] border-r border-r-[#b8cce4]">
                        {fmt(hoja4.totals.sc50)}
                      </td>
                      <td className="px-2 py-1.5 font-bold text-black text-center border-t-2 border-t-[#8fa3c2] border-b border-b-[#c5d5e6]">
                        {fmt(hoja4.totals.ph)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'hoja1' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-600">Fuente: {hoja1.sheetName || 'No detectada'}</div>

          <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1.5">
            <input
              type="text"
              value={newProducto}
              onChange={(e) => setNewProducto(e.target.value)}
              placeholder="Nuevo producto"
              className="min-w-[220px] flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <input
              type="number"
              step="0.01"
              value={newPeso}
              onChange={(e) => setNewPeso(e.target.value)}
              placeholder="Peso"
              className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => {
                const producto = newProducto.trim();
                const peso = Number(newPeso);
                if (!producto || Number.isNaN(peso)) return;
                setHoja1Rows((prev) => [...prev, { producto, peso }]);
                setNewProducto('');
                setNewPeso('');
              }}
              className="px-2.5 py-1 text-xs font-semibold bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Agregar
            </button>
          </div>

          <div className={MAKRO_SCROLL_FORM_TAB}>
            <table className="w-full border-collapse text-center text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#dbe5f1] text-black border-b border-[#b8cce4]">
                  <th className="font-bold text-[12px] px-2 py-1 text-left">DESCRIPCION_PRODUCTO</th>
                  <th className="font-bold text-[12px] px-2 py-1">peso</th>
                  <th className="font-bold text-[12px] px-2 py-1">Acción</th>
                </tr>
              </thead>
              <tbody>
                {hoja1Rows.length === 0 ? (
                  <tr className="bg-white">
                    <td colSpan={3} className="px-3 py-4 text-xs text-black text-center">
                      No se encontraron datos de Hoja1 en este archivo.
                    </td>
                  </tr>
                ) : (
                  hoja1Rows.map((r, idx) => (
                    <tr
                      key={`${r.producto}-${idx}`}
                      className="bg-white border-t border-[#eef3f8] transition-colors"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = ROW_BG_HOVER;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '';
                      }}
                    >
                      <td className="px-2 py-0.5 text-left">
                        <input
                          type="text"
                          value={r.producto}
                          onChange={(e) =>
                            setHoja1Rows((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, producto: e.target.value } : item
                              )
                            )
                          }
                          className="w-full min-w-[260px] px-1 py-0.5 text-xs border border-gray-200 rounded"
                        />
                      </td>
                      <td className="px-2 py-0.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={String(r.peso)}
                          onChange={(e) =>
                            setHoja1Rows((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? {
                                      ...item,
                                      peso:
                                        e.target.value === ''
                                          ? ''
                                          : num(e.target.value.replace(',', '.'))
                                    }
                                  : item
                              )
                            )
                          }
                          className="w-20 px-1 py-0.5 text-xs border border-gray-200 rounded text-right"
                        />
                      </td>
                      <td className="px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() => setHoja1Rows((prev) => prev.filter((_, i) => i !== idx))}
                          className="px-2 py-0.5 text-[11px] border border-red-300 text-red-700 rounded hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sacos' && (
        <div className="space-y-2">
          <div className={MAKRO_SCROLL_MAIN}>
            <table className="w-full border-collapse text-center text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#dbe5f1] text-black border-b border-[#b8cce4]">
                  <th className="font-bold text-[12px] px-2 py-1 text-left">Etiquetas de fila</th>
                  <th className="font-bold text-[12px] px-2 py-1">NRO_OC</th>
                  <th className="font-bold text-[12px] px-2 py-1">Suma de SC50</th>
                  <th className="font-bold text-[12px] px-2 py-1">Suma de PH</th>
                </tr>
              </thead>
              <tbody>
                {sacosTotales.rows.length === 0 ? (
                  <tr className="bg-white">
                    <td colSpan={4} className="px-3 py-4 text-xs text-black text-center">
                      No hay datos para mostrar.
                    </td>
                  </tr>
                ) : (
                  <>
                    {sacosTotales.rows.map((r) => (
                      <tr
                        key={r.tienda}
                        className="bg-white border-t border-[#eef3f8] transition-colors"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = ROW_BG_HOVER;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '';
                        }}
                      >
                        <td className="px-2 py-0.5 text-left">{r.tienda}</td>
                        <td className="px-2 py-0.5">{r.nroOc}</td>
                        <td className="px-2 py-0.5">{fmt(r.sc50)}</td>
                        <td className="px-2 py-0.5">{fmt(r.ph)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#dbe5f1] border-t border-[#9eb6ce]">
                      <td className="px-2 py-0.5 text-left font-bold">Total general</td>
                      <td className="px-2 py-0.5 font-bold">-</td>
                      <td className="px-2 py-0.5 font-bold">{fmt(sacosTotales.totals.sc50)}</td>
                      <td className="px-2 py-0.5 font-bold">{fmt(sacosTotales.totals.ph)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default MakroAnalysisResults;
