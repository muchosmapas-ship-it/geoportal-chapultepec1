Visor de ortofoto: Chapultepec Seccion 4 - Ortofoto RGB 2026
Generado: 2026-09-09T13:12:18-0600
Origen:   F:\INYDES\Vuelos\Seccion4\Ortomosaico\s4\Ortomosaico_Seccion_4.tif

ESTRUCTURA
----------
F:\geoportal_chapultepec\visor_web_export\ortofoto_S4\RGB/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (15..19, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -99.238417, 19.386527
NE: -99.222991, 19.394079
Centro: -99.230704, 19.390303

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_chapultepec\visor_web_export\ortofoto_S4\RGB
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     Chapultepec Seccion 4 - Ortofoto RGB 2026
5) Attribution: Ortofoto UAV - Seccion 4 Chapultepec - INyDES 2026 - GSD 5cm
6) Max zoom: 19

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_chapultepec\visor_web_export\ortofoto_S4\RGB"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV - Seccion 4 Chapultepec - INyDES 2026 - GSD 5cm' })

ESTADISTICAS
------------
{
  "tiles": 447,
  "bytes": 26289830,
  "per_zoom": {
    "15": 4,
    "16": 12,
    "17": 28,
    "18": 91,
    "19": 312
  },
  "zmax_natural": 7
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV - Seccion 4 Chapultepec - INyDES 2026 - GSD 5cm
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
