Visor de ortofoto: Ortofoto Seccion 2
Generado: 2026-09-10T17:04:28-0600
Origen:   F:\INYDES\Vuelos\Seccion2\corte\1\Ortomosaico_seccion2_5cm_u8_clean.tif

ESTRUCTURA
----------
F:\geoportal_chapultepec\visor_web_export\ortofoto_S2\RGB_clean/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (15..19, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -99.205740, 19.399858
NE: -99.188286, 19.427734
Centro: -99.197013, 19.413796

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_chapultepec\visor_web_export\ortofoto_S2\RGB_clean
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     Ortofoto Seccion 2
5) Attribution: Ortofoto UAV INyDES 2026 GSD 5cm/px Seccion 2
6) Max zoom: 19

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_chapultepec\visor_web_export\ortofoto_S2\RGB_clean"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV INyDES 2026 GSD 5cm/px Seccion 2' })

ESTADISTICAS
------------
{
  "tiles": 1561,
  "bytes": 115341496,
  "per_zoom": {
    "15": 8,
    "16": 24,
    "17": 77,
    "18": 308,
    "19": 1144
  },
  "zmax_natural": 8
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV INyDES 2026 GSD 5cm/px Seccion 2
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
