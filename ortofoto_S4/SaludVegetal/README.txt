Visor de ortofoto: Chapultepec Seccion 4 - Salud Vegetal 2026
Generado: 2026-09-09T13:13:48-0600
Origen:   F:\INYDES\Vuelos\Seccion4\Ortomosaico\s4\Ortomosaico_Seccion_4_Salud_Vegetal.tif

ESTRUCTURA
----------
F:\geoportal_chapultepec\visor_web_export\ortofoto_S4\SaludVegetal/
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
     cd F:\geoportal_chapultepec\visor_web_export\ortofoto_S4\SaludVegetal
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     Chapultepec Seccion 4 - Salud Vegetal 2026
5) Attribution: Salud Vegetal UAV - Seccion 4 Chapultepec - INyDES 2026 - GSD 5cm
6) Max zoom: 19

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_chapultepec\visor_web_export\ortofoto_S4\SaludVegetal"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Salud Vegetal UAV - Seccion 4 Chapultepec - INyDES 2026 - GSD 5cm' })

ESTADISTICAS
------------
{
  "tiles": 447,
  "bytes": 26812057,
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
Atribucion obligatoria: Salud Vegetal UAV - Seccion 4 Chapultepec - INyDES 2026 - GSD 5cm
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
