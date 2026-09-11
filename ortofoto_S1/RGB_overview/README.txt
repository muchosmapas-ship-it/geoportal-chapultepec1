Visor de ortofoto: seccion1
Generado: 2026-09-11T10:41:33-0600
Origen:   F:\INYDES\Vuelos\seccion1\ortomosaico\Ortomosaico_S1_5cm.tif

ESTRUCTURA
----------
F:\geoportal_chapultepec\visor_web_export\ortofoto_S1\RGB_overview/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (13..17, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -99.196098, 19.412120
NE: -99.175926, 19.429735
Centro: -99.186012, 19.420927

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_chapultepec\visor_web_export\ortofoto_S1\RGB_overview
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     seccion1
5) Attribution: Orto UAV INyDES 2026 S1 - overview 50cm/px
6) Max zoom: 17

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_chapultepec\visor_web_export\ortofoto_S1\RGB_overview"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Orto UAV INyDES 2026 S1 - overview 50cm/px' })

ESTADISTICAS
------------
{
  "tiles": 107,
  "bytes": 5988211,
  "per_zoom": {
    "13": 2,
    "14": 4,
    "15": 9,
    "16": 20,
    "17": 72
  },
  "zmax_natural": 5
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Orto UAV INyDES 2026 S1 - overview 50cm/px
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
