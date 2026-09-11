Visor de ortofoto: seccion3_barrilaco
Generado: 2026-09-11T10:42:27-0600
Origen:   F:\INYDES\Vuelos\Seccion3\Corte\Ortomosaico_Seccion_3_Ba.jp2

ESTRUCTURA
----------
F:\geoportal_chapultepec\visor_web_export\ortofoto_S3_Ba\RGB_overview/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (13..17, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -99.228481, 19.408745
NE: -99.216355, 19.428064
Centro: -99.222418, 19.418405

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_chapultepec\visor_web_export\ortofoto_S3_Ba\RGB_overview
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     seccion3_barrilaco
5) Attribution: Orto UAV INyDES 2026 S3 Barrilaco - overview 50cm/px
6) Max zoom: 17

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_chapultepec\visor_web_export\ortofoto_S3_Ba\RGB_overview"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Orto UAV INyDES 2026 S3 Barrilaco - overview 50cm/px' })

ESTADISTICAS
------------
{
  "tiles": 69,
  "bytes": 1145255,
  "per_zoom": {
    "13": 1,
    "14": 2,
    "15": 6,
    "16": 15,
    "17": 45
  },
  "zmax_natural": 5
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Orto UAV INyDES 2026 S3 Barrilaco - overview 50cm/px
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
