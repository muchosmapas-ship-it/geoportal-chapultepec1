# Documentación Técnica: Actualización Integral del Geoportal Chapultepec
**Proyecto:** Geoportal Evaluación del Estado del Arbolado en Chapultepec  
**Fecha:** Septiembre 2026  
**Entorno de desarrollo:** Local (`http://127.0.0.1:8000/`) & Remoto (`GitHub origin/main`)  
**Repositorio:** `https://github.com/muchosmapas-ship-it/geoportal-chapultepec1.git`  

---

## 1. Resumen Ejecutivo

En esta iteración se completaron cuatro objetivos principales solicitados para el Geoportal:

1. **Corrección y optimización del cono focal de 135m y reproductor de vuelo UAV**:
   - Ajuste de la apertura focal de cámara (70°) y alcance dinámico de ~135 metros a 56 metros de altitud sobre el terreno.
   - Desacople del enfoque automático al arranque para no bloquear la vista general del bosque.
   - Reducción del ancho del modal de video de `1150px` a `800px` para una experiencia visual equilibrada.
2. **Unificación del Ortomosaico RGB**:
   - Eliminación de controles divididos por secciones y remoción de la antigua capa redundante "Salud Vegetal (Sección 4)".
   - Unificación de las 5 secciones fotogramétricas RGB bajo un solo control: **`[x] Ortomosaico`**.
3. **Ingesta, remuestreo y pirámide de teselas de Salud Vegetal (VARI)**:
   - Procesamiento de los 6 archivos GeoTIFF ubicados en `F:\INYDES\VARI`.
   - Reducción de **~647 MB en archivos TIF originales a solo 70.5 MB** en teselas PNG Web Mercator (EPSG:3857, zooms 13 al 18) en `ortofoto_VARI/tiles/`.
   - Control único en el panel de capas: **`[x] Salud vegetal (VARI)`**.
4. **Centrado panorámico inicial y control interactivo `🎯 Centrar todo`**:
   - Configuración de la vista de inicio para abarcar simultáneamente las Secciones 1, 2, 3, 3 Barrilaco y 4, con compensación por el panel lateral.
   - Botón interactivo en la cabecera de la tarjeta Ortomosaico para re-centrar el visor en cualquier momento.

---

## 2. Ingesta y Procesamiento de Salud Vegetal (VARI)

### 2.1 Archivos Fuente Procesados (`F:\INYDES\VARI`)
| Archivo | Dimensión (px) | Cobertura WGS84 (Lon / Lat) | Sección Chapultepec |
| :--- | :--- | :--- | :--- |
| `S1VARI.tif` | 14,104 x 12,982 | `[-99.1961, 19.4121]` a `[-99.1759, 19.4297]` | Sección 1 (Principal) |
| `S1VARI_b.tif` | 4,819 x 3,846 | `[-99.2030, 19.4230]` a `[-99.1975, 19.4296]` | Sección 1 (Parque Líbano) |
| `S2VARI.tif` | 8,518 x 15,279 | `[-99.2057, 19.4063]` a `[-99.1935, 19.4270]` | Sección 2 |
| `S3VARI_M.tif` | 14,898 x 16,856 | `[-99.2264, 19.3966]` a `[-99.2051, 19.4194]` | Sección 3 |
| `S3VARI_barri.tif`| 8,472 x 14,243 | `[-99.2285, 19.4087]` a `[-99.2164, 19.4281]` | Sección 3 (Barrilaco) |
| `S4VARI.tif` | 10,791 x 5,556 | `[-99.2384, 19.3865]` a `[-99.2230, 19.3941]` | Sección 4 |

### 2.2 Estrategia de Remuestreo y Pirámide de Teselas
- **Proyección destino**: WGS 84 / Pseudo-Mercator (`EPSG:3857`).
- **Resolución base (Zoom 18)**: `0.59716 m/px` (resolución submétrica óptima para visualización web de copas de árboles).
- **Manejo de traslapes (Alpha Compositing)**: En las áreas donde dos secciones se tocan o solapan (p. ej. Sección 1 y Parque Líbano, o Sección 3 y Barrilaco), el algoritmo combina las capas mediante mezcla de canal alfa (`RGBA`), evitando cortes abruptos o fondos negros.
- **Generación de pirámides descendentes (Z17 a Z13)**: Construcción por remuestreo `Lanczos` de 4 cuadrantes hijos a 1 padre de `256x256 px`.
- **Estructura resultante**:
  ```text
  ortofoto_VARI/tiles/
  ├── 13/ (4 teselas)
  ├── 14/ (7 teselas)
  ├── 15/ (19 teselas)
  ├── 16/ (55 teselas)
  ├── 17/ (163 teselas)
  └── 18/ (504 teselas)
  Total: 752 teselas PNG optimizadas (70.54 MB en disco)
  ```

---

## 3. Configuración y Frontend (`config.js`, `app.js`, `style.css`)

### 3.1 Estructura en `data/config.js`
- Se dio de alta la capa raster `vari`:
  ```javascript
  "vari": {
      "attribution": "Salud Vegetal VARI UAV INyDES 2026",
      "label": "Salud vegetal (VARI)",
      "maxZoom": 18,
      "minZoom": 13,
      "type": "xyz",
      "url": "./ortofoto_VARI/tiles/{z}/{x}/{y}.png?v=77"
  }
  ```
- Se eliminaron las entradas anteriores de `salud` y `salud_overview` que correspondían únicamente a la Sección 4.
- Se ajustaron las coordenadas de inicio globales:
  ```javascript
  "CENTER": [-99.2072, 19.4081],
  "ZOOM": 13.6
  ```

### 3.2 Lógica del Visor en `js/app.js`
- **Jerarquía de capas (Z-Index)**:
  - `osm`: `zIndex = 1` (Fondo)
  - `ortomosaico` (RGB Overview / Detalle): `zIndex = 10 / 20`
  - `vari` (Salud vegetal VARI): `zIndex = 25` (Superpuesto a la ortofoto RGB)
  - `subzonas` y `arboles`: `zIndex = 100 / 101` (Capas vectoriales superiores)
- **Panel de capas unificado**:
  ```html
  <div class="form-check">
      <input class="form-check-input" type="checkbox" id="base-vari" checked>
      <label class="form-check-label" for="base-vari">Salud vegetal (VARI)</label>
  </div>
  <div class="form-check">
      <input class="form-check-input" type="checkbox" id="base-ortomosaico" checked>
      <label class="form-check-label" for="base-ortomosaico">Ortomosaico</label>
  </div>
  <div class="form-check">
      <input class="form-check-input" type="checkbox" id="base-osm" checked>
      <label class="form-check-label" for="base-osm">Mapa base - OpenStreetMap</label>
  </div>
  ```
- **Función `fitWholeChapultepec`**:
  Calcula el bounding box envolvente de todo Chapultepec (`[-99.23842, 19.38653, -99.17593, 19.42973]`) y ajusta la vista de OpenLayers considerando el ancho del `#sidebar` (`padding: [30, 40, 30, sidebarWidth + 30]`).
- **Desacople del Vuelo UAV**:
  `renderFlightTelemetryOnMap` dibuja la trayectoria sin alterar la vista panorámica del mapa. El enfoque hacia el cono focal del dron ocurre exclusivamente al presionar `btnVideo`.

### 3.3 Estilo en `css/style.css`
- Tamaño del reproductor de video HUD ajustado a `800px`:
  ```css
  #flight-video-modal {
      width: 90vw;
      max-width: 800px;
  }
  ```

---

## 4. Registro de Versiones y Commits en GitHub

Todos los cambios fueron confirmados y enviados a la rama `main` de GitHub (`https://github.com/muchosmapas-ship-it/geoportal-chapultepec1.git`):

| Commit | Descripción | Archivos Clave |
| :--- | :--- | :--- |
| `710e2c9` | Integración ortomosaico unificado Salud vegetal (VARI) en 5 secciones, optimización de teselas y ajuste modal de video a 800px. | `config.js`, `app.js`, `style.css`, `index.html`, `ortofoto_VARI/` |
| `9f68eb9` | Actualización Salud vegetal (VARI) integrando nuevo archivo `S1VARI_b.tif` (Parque Líbano). | `config.js`, `index.html`, `ortofoto_VARI/tiles/` |
| `db14086` | Centrado inicial del visor para abarcar todo el ortomosaico de Chapultepec y botón `🎯 Centrar todo`. | `config.js`, `index.html`, `js/app.js` |

---

## 5. Estado de Pruebas y Validación

1. **Navegación y rendimiento local (`http://127.0.0.1:8000/`)**:
   - Carga de teselas VARI sin demoras (tiempos de respuesta inferiores a 25ms por tesela local).
   - Alternancia limpia de capas:
     - Con **`Salud vegetal (VARI)`** activo: se observa el índice de vegetación continuo sobre las 5 secciones.
     - Con **`Salud vegetal (VARI)`** inactivo: se visualiza la ortofoto RGB natural.
     - Con ambos inactivos: se visualiza la cartografía base OpenStreetMap.
2. **Auto-centrado panorámico**:
   - Verificado en resoluciones estándar y panorámicas. El bosque completo permanece en pantalla desde el primer segundo.
   - El botón `🎯 Centrar todo` restaura el encuadre óptimo en cualquier momento.
