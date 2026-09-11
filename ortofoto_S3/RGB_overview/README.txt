Visor de ortofoto: seccion3
Generado: 2026-09-11T10:42:25-0600
Origen:   F:\INYDES\Vuelos\Seccion3\Corte\Ortomosaico_Seccion_3_m.jp2

ESTRUCTURA
----------
F:\geoportal_chapultepec\visor_web_export\ortofoto_S3\RGB_overview/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (13..17, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -99.226425, 19.396558
NE: -99.205113, 19.419430
Centro: -99.215769, 19.407994

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_chapultepec\visor_web_export\ortofoto_S3\RGB_overview
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     seccion3
5) Attribution: Orto UAV INyDES 2026 S3 - overview 50cm/px
6) Max zoom: 17

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_chapultepec\visor_web_export\ortofoto_S3\RGB_overview"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Orto UAV INyDES 2026 S3 - overview 50cm/px' })

ESTADISTICAS
------------
{
  "tiles": 129,
  "bytes": 5343387,
  "per_zoom": {
    "13": 1,
    "14": 4,
    "15": 9,
    "16": 25,
    "17": 90
  },
  "zmax_natural": 5
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Orto UAV INyDES 2026 S3 - overview 50cm/px
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
