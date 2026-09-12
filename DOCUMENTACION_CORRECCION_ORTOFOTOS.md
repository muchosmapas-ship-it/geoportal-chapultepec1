# 📚 Guía Técnica: Procesamiento, Corrección y Despliegue de Ortofotos

Esta documentación contiene el diagnóstico, metodología matemática y flujo de trabajo automatizado para la re-proyección, corrección de distorsión, eliminación de fondo negro y despliegue de las ortofotos del **Geoportal Chapultepec**.

---

## 🎯 1. Resumen de Desafíos y Causas Raíz Identificadas

En las ortofotos procesadas a partir de vuelos UAV se identificaron 4 causas principales de error que deben prevenirse o corregirse en futuras actualizaciones:

| Problema Observado | Causa Raíz Técnica | Solución Aplicada |
| :--- | :--- | :--- |
| **Desfase Espacial (~750m hacia el Sur)** | El ráster original está en **UTM Zona 14N (`EPSG:32614`)**, mientras que los visores web utilizan **Web Mercator (`EPSG:3857`)**. La conversión de coordenadas en manifiestos antiguos desfasó la latitud. | Re-proyección matemática directa de **EPSG:32614 a EPSG:3857** con `pyproj` + `rasterio.warp.reproject`. |
| **Ráster Cortado / Incompleto** | El archivo `.jp2` original sólo cubría la porción norte de la sección (Lat 19.406 a 19.427), omitiendo la porción sur. | Utilizar el GeoTIFF / JP2 máster completo (`Ortomosaico_seccion2_5cm_u8_clean.tif` o `Ortomosaico_seccion2_new.jp2`). |
| **Distorsión / Deformación Visual** | Recortes de teselas con relación de aspecto no cuadrada que se forzaban a redimensionar a `256 x 256` píxeles, deformando construcciones y avenidas. | Grilla de píxeles **cuadrada exacta (Aspect Ratio 1:1)** en Web Mercator previa al escalado Lanczos. |
| **Bordes / Fondo Negro** | Falta de canal transparente (`Alpha`) en píxeles de relleno `(RGB < 12)` y fuera del límite poligonal de la sección. | Creación de teselas en formato **RGBA (4 canales)** con máscara del shapefile de corte (`Corte2.shp`) y filtrado de negros `(R+G+B < 12)`. |
| **Persistencia de Imágenes Viejas en la Web** | La caché en disco de los navegadores guarda las imágenes antiguas `.png` aunque el servidor tenga las nuevas. | Agregar parámetros de versión `?v=N` a las URLs de teselas en `data/config.js` y crear archivo `_headers` en Netlify. |

---

## 🛠️ 2. Flujo de Trabajo Paso a Paso para Futuras Actualizaciones

Para procesar o actualizar cualquier sección de ortofotos del Bosque de Chapultepec, sigue estos 5 pasos:

### Paso 1: Preparación de Archivos Máster
Asegúrate de contar en la carpeta del proyecto con:
- **Ráster Máster de Ortofoto**: Archivo `.tif` o `.jp2` (ej. `F:\INYDES\Vuelos\Seccion2\corte\Ortomosaico_seccion2_new.jp2`).
- **Polígono de Corte (Shapefile)**: Archivo `.shp` del límite oficial de la sección (ej. `C:\nube\Inydes\Chapultepec\Seccion_2\shp\Corte2.shp`).

---

### Paso 2: Ejecución del Script de Re-Proyección y Teselado RGBA 1:1

Crea o ejecuta un script de Python con el siguiente estándar:

```python
import os, sys, math, shutil, json, time
import numpy as np
from PIL import Image, ImageDraw
import shapefile
from pyproj import Transformer
from shapely.geometry import Polygon

# 1. Configurar directorio PROJ interno de rasterio (Evita conflictos con PostGIS/ArcGIS)
r_proj = r'C:\Users\edgar\AppData\Local\Programs\Python\Python312\Lib\site-packages\rasterio\proj_data'
os.environ['PROJ_DATA'] = r_proj
os.environ['PROJ_LIB'] = r_proj

import rasterio
from rasterio.warp import reproject, Resampling

# 2. Archivos de entrada
src_path = r'F:\INYDES\Vuelos\Seccion2\corte\Ortomosaico_seccion2_new.jp2'
shp_path = r'C:\nube\Inydes\Chapultepec\Seccion_2\shp\Corte2.shp'

src_ds = rasterio.open(src_path)

to_3857 = Transformer.from_crs("EPSG:32614", "EPSG:3857", always_xy=True)
to_4326 = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
to_3857_from_4326 = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

# 3. Transformar Shapefile de Corte a EPSG:3857
sf = shapefile.Reader(shp_path)
pts_4326 = sf.shape(0).points
pts_3857 = [to_3857_from_4326.transform(lon, lat) for lon, lat in pts_4326]

# 4. Calcular límites exactos en Web Mercator
left_utm, bottom_utm, right_utm, top_utm = src_ds.bounds
min_x, min_y = to_3857.transform(left_utm, bottom_utm)
max_x, max_y = to_3857.transform(right_utm, top_utm)

min_lon, min_lat = to_4326.transform(min_x, min_y)
max_lon, max_lat = to_4326.transform(max_x, max_y)

# Definir resolución cuadrada exacta (0.15m/px = alta definición sin distorsión)
res = 0.15
out_w = int(math.ceil((max_x - min_x) / res))
out_h = int(math.ceil((max_y - min_y) / res))

max_x_aligned = min_x + out_w * res
min_y_aligned = max_y - out_h * res

# 5. Cargar en memoria y Re-Proyectar
scale = 2 # Factor de aceleración de lectura
out_h_src = src_ds.height // scale
out_w_src = src_ds.width // scale

src_data = src_ds.read([1, 2, 3], out_shape=(3, out_h_src, out_w_src))
src_transform = src_ds.transform * src_ds.transform.scale(src_ds.width / out_w_src, src_ds.height / out_h_src)

warped_rgb = np.zeros((3, out_h, out_w), dtype=np.uint8)
dst_transform = rasterio.transform.from_bounds(min_x, min_y_aligned, max_x_aligned, max_y, out_w, out_h)

for b in range(3):
    reproject(
        source=src_data[b],
        destination=warped_rgb[b],
        src_transform=src_transform,
        src_crs=src_ds.crs or "EPSG:32614",
        dst_transform=dst_transform,
        dst_crs="EPSG:3857",
        resampling=Resampling.bilinear
    )

src_ds.close()

# 6. Generar Máscara Transparente RGBA (Eliminar Fondo Negro + Máscara Shapefile)
rgba_array = np.zeros((4, out_h, out_w), dtype=np.uint8)
rgba_array[:3] = warped_rgb

rgb_sum = np.sum(warped_rgb, axis=0)
alpha_black = (rgb_sum >= 12).astype(np.uint8) * 255

poly_mask_img = Image.new('L', (out_w, out_h), 0)
draw = ImageDraw.Draw(poly_mask_img)

poly_px = []
for x, y in pts_3857:
    col = (x - min_x) / res
    row = (max_y - y) / res
    poly_px.append((col, row))

draw.polygon(poly_px, fill=255)
poly_mask_np = np.array(poly_mask_img, dtype=np.uint8)

rgba_array[3] = np.minimum(alpha_black, poly_mask_np)

# 7. Generación de Teselas Cuadradas (Zooms 13 a 19)
ORIGIN_SHIFT = 20037508.342789244

def tile_bounds_3857(tile_x, tile_y, zoom):
    res_z = (2 * ORIGIN_SHIFT) / (256 * (2 ** zoom))
    x1 = tile_x * 256 * res_z - ORIGIN_SHIFT
    y1 = ORIGIN_SHIFT - tile_y * 256 * res_z
    x2 = (tile_x + 1) * 256 * res_z - ORIGIN_SHIFT
    y2 = ORIGIN_SHIFT - (tile_y + 1) * 256 * res_z
    return x1, y2, x2, y1

def meters_to_tile(x, y, zoom):
    res_z = (2 * ORIGIN_SHIFT) / (256 * (2 ** zoom))
    mx = x + ORIGIN_SHIFT
    my = ORIGIN_SHIFT - y
    return int(mx / (res_z * 256)), int(my / (res_z * 256))

out_dir_clean = r'F:\geoportal_chapultepec\visor_web_export\ortofoto_S2\RGB_clean\tiles'
out_dir_overview = r'F:\geoportal_chapultepec\visor_web_export\ortofoto_S2\RGB_overview\tiles'

if os.path.exists(out_dir_clean):
    shutil.rmtree(out_dir_clean)
if os.path.exists(out_dir_overview):
    shutil.rmtree(out_dir_overview)

os.makedirs(out_dir_clean, exist_ok=True)
os.makedirs(out_dir_overview, exist_ok=True)

for z in range(13, 20):
    tx_min, ty_min = meters_to_tile(min_x, max_y, z)
    tx_max, ty_max = meters_to_tile(max_x, min_y, z)
    
    for tx in range(tx_min, tx_max + 1):
        for ty in range(ty_min, ty_max + 1):
            t_left, t_bottom, t_right, t_top = tile_bounds_3857(tx, ty, z)
            
            c1 = int(round((t_left - min_x) / res))
            c2 = int(round((t_right - min_x) / res))
            r1 = int(round((max_y - t_top) / res))
            r2 = int(round((max_y - t_bottom) / res))
            
            w_crop = c2 - c1
            h_crop = r2 - r1
            if w_crop <= 0 or h_crop <= 0:
                continue
                
            tile_rgba_full = np.zeros((4, h_crop, w_crop), dtype=np.uint8)
            
            sr1, sr2 = max(0, r1), min(out_h, r2)
            sc1, sc2 = max(0, c1), min(out_w, c2)
            if sr2 <= sr1 or sc2 <= sc1:
                continue
                
            dr1 = sr1 - r1
            dr2 = dr1 + (sr2 - sr1)
            dc1 = sc1 - c1
            dc2 = dc1 + (sc2 - sc1)
            
            tile_rgba_full[:, dr1:dr2, dc1:dc2] = rgba_array[:, sr1:sr2, sc1:sc2]
            
            if not np.any(tile_rgba_full[3] > 0):
                continue
                
            img = Image.fromarray(np.transpose(tile_rgba_full, (1, 2, 0)), mode="RGBA")
            img_resized = img.resize((256, 256), Image.Resampling.LANCZOS)
            
            for b in [out_dir_clean, out_dir_overview]:
                tile_dir = os.path.join(b, str(z), str(tx))
                os.makedirs(tile_dir, exist_ok=True)
                img_resized.save(os.path.join(tile_dir, f"{ty}.png"), "PNG", optimize=True)
```

---

### Paso 3: Configuración de Cachebuster en URLs (`data/config.js`)
Para forzar a los navegadores a actualizar las teselas sin usar la caché antigua, siempre incrementa la versión `?v=N` en la propiedad `"url"` de `data/config.js`:

```javascript
"seccion2_rgb": {
    "attribution": "Ortofoto UAV INyDES 2026 GSD 5cm/px Seccion 2",
    "label": "Ortofoto Seccion 2",
    "type": "xyz",
    "url": "./ortofoto_S2/RGB_clean/tiles/{z}/{x}/{y}.png?v=75",
    "minZoom": 13,
    "maxZoom": 19
}
```

---

### Paso 4: Creación de Encabezados de Invalidación para Netlify (`_headers`)
Asegúrate de que en la raíz del proyecto exista el archivo `_headers` con las siguientes directivas:

```http
/*
  Cache-Control: no-cache, no-store, must-revalidate

/ortofoto_*/*
  Cache-Control: public, max-age=0, must-revalidate
```

---

### Paso 5: Verificación Local y Despliegue en Git
1. **Comprobar Localmente**: Abre `http://127.0.0.1:8000/?nocache=N` y verifica que:
   - No haya distorsión ni estiramiento.
   - El fondo negro sea 100% transparente.
   - El ensamble con las otras secciones sea exacto.
2. **Subir a GitHub**:
   ```bash
   git add -A
   git commit -m "Actualizacion de ortofotos con teselado cuadrado RGBA sin distorsion ni fondo negro"
   git push origin main
   ```

---

## 📌 Checklist Rápido para Futuras Actualizaciones

- [ ] ¿El ráster de origen es el archivo máster completo (`.tif` o `.jp2`)?
- [ ] ¿Se utilizó la máscara `.shp` correspondiente a la sección?
- [ ] ¿El canal Alfa (`RGBA`) filtra los píxeles negros `R+G+B < 12`?
- [ ] ¿La grilla del ráster intermedio mantiene resolución de celda cuadrada (`res_x == res_y`)?
- [ ] ¿Se incrementó el parámetro `?v=N` en `data/config.js` e `index.html`?
- [ ] ¿Se verificó en `http://127.0.0.1:8000/` antes de realizar `git push`?
