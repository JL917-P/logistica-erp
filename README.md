# Logística ERP

Aplicación fullstack para analizar cargas Excel (pedidos Makro / logística). **Frontend:** React + Vite. **Backend:** Node.js + Express.

---

## Ejecución local (desarrollo)

Requisitos: **Node.js ≥ 18.18**.

1. Instalar dependencias (raíz + servicios):

   ```bash
   npm run install:all
   ```

   O bien, por carpeta:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. Arrancar **backend** y **frontend** a la vez (proxy de `/api` hacia el backend):

   ```bash
   npm run dev
   ```

   - Frontend (Vite): [http://127.0.0.1:2000](http://127.0.0.1:2000) — ver `vite.config.js` y variable opcional `VITE_DEV_PORT`.
   - Backend: puerto **3001** por defecto (`process.env.PORT`).

3. **Proxy en desarrollo:** el frontend envía peticiones a rutas relativas `/api/...`. Vite reenvía al backend según `VITE_DEV_PROXY_TARGET` (por defecto `http://127.0.0.1:3001`). Puedes crear `frontend/.env.development`:

   ```env
   VITE_DEV_PROXY_TARGET=http://127.0.0.1:3001
   VITE_DEV_PORT=2000
   ```

---

## Ejecución local (producción en un solo puerto)

Simula el despliegue en Render: un solo proceso sirve API + SPA.

Desde la **raíz del repositorio**:

```bash
npm run build
npm start
```

Abre **http://127.0.0.1:3001** (o el valor de `PORT`). El servidor entrega React desde `frontend/dist` y monta `/api/upload`, `/api/upload-makro`, `/api/health`.

---

## Deploy en Render (Web Service)

1. Crear un **Web Service** conectado a este repositorio.
2. Configuración sugerida:
   - **Root directory:** *(vacío, raíz del repo)* — o la carpeta donde esté este `README.md`.
   - **Environment:** Node.
   - **Build command:**

     ```bash
     npm run build
     ```

     Este script instala dependencias con `npm ci` en `frontend` y `backend`, compila Vite (`frontend/dist`) y deja instalado el backend.

   Si en tu máquina `npm ci` falla por permisos (p. ej. Windows con archivos bloqueados), puedes ejecutar manualmente:

   ```bash
   cd frontend && npm install && npm run build
   cd ../backend && npm install
   ```

   - **Start command:**

     ```bash
     npm start
     ```

     Equivale a `npm start --prefix backend` → `node server.js`.

3. **Health check:** en el panel del servicio, usa **`/api/health`** (liviano y sin autenticación). El `render.yaml` incluye `healthCheckPath: /api/health` si despliegas con Blueprint.

4. **Variables de entorno (opcional):**
   - `NODE_VERSION`: por ejemplo `20.18.0` (recomendable).
   - `NODE_ENV=production` (rendimiento y mensajes de error genéricos en 500).
   - Render asigna `PORT`; el servidor escucha en `0.0.0.0`.

5. **Build en Render:** el comando debe ejecutarse desde la **raíz del repo** (donde está este README). Render suele ejecutar `npm install` en la raíz antes del build; si el build falla, prueba **Build Command:** `npm install && npm run build`.

6. **Subida de archivos:** Multer usa **`memoryStorage`** (solo RAM, sin disco). Límite **10 MB**. En planes free, vigila el uso de memoria con Excel muy grandes.

7. Rutas relativas **`/api/...`** y mismo origen: no hace falta URL absoluta del API en el frontend.

---

## Lista de revisión producción / Render

| Área | Estado |
|------|--------|
| Puerto | `process.env.PORT` ✓ |
| Bind | `0.0.0.0` ✓ |
| Estáticos SPA | `__dirname/../frontend/dist` (no depende del `cwd`) ✓ |
| Subidas multipart | **No** enviar `Content-Type: multipart/form-data` manual (necesita `boundary`) ✓ |
| Errores Multer | Middleware global `MulterError` + tipo de archivo ✓ |
| Icono `/vite.svg` | `frontend/public/vite.svg` copiado a `dist` por Vite ✓ |
| Proxy TLS | `app.set('trust proxy', 1)` ✓ |
| JSON body | `express.json({ limit: '2mb' })` (subidas van por multipart) ✓ |
| React Router | No aplica: SPA en una sola ruta; fallback `index.html` correcto ✓ |
| `npm ci` en build | Requiere `package-lock.json` en `frontend/` y `backend/` versionados ✓ |

---

## Estructura relevante

| Ruta | Uso |
|------|-----|
| `backend/server.js` | API Express, `express.static` de `frontend/dist`, fallback SPA, `multer.memoryStorage()` |
| `frontend/dist/` | Salida de `vite build` (generada en el build, no es obligatorio versionarla) |
| `frontend/vite.config.js` | `base: '/'`, proxy `/api` solo en desarrollo |

---

## Seguridad básica (backend)

- **helmet**: cabeceras HTTP endurecidas. `Content-Security-Policy` y `Cross-Origin-Embedder-Policy` van desactivados para no romper el embed de Google Maps ni el bundle de Vite.
- **Límite de frecuencia** en `POST /api/upload` y `POST /api/upload-makro`: por defecto **40** solicitudes por **15 minutos** e IP (ajustable con `RATE_LIMIT_UPLOAD_MAX` y `RATE_LIMIT_UPLOAD_WINDOW_MS`).
- **Validación de libro Excel / CSV**: comprobación por **firma de archivo** (ZIP + `xl/` para `.xlsx`, OLE para `.xls`, texto sin NUL para CSV), además del `fileFilter` de Multer por MIME.

---

## Salud del servicio

`GET /api/health` devuelve JSON `{ "status": "ok", ... }` útil para comprobaciones en Render.
