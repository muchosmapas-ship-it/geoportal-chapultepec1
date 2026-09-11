Visor de ortofoto: Ortofoto S1
Generado: 2026-09-09T17:05:39-0600
Origen:   F:\INYDES\Vuelos\seccion1\ortomosaico\Ortomosaico_Sección_1_r.jp2

ESTRUCTURA
----------
ortofoto_S1\RGB/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (15..19, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -99.196098, 19.412116
NE: -99.175927, 19.429735
Centro: -99.186013, 19.420926

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd ortofoto_S1\RGB
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     Ortofoto S1
5) Attribution: Ortofoto UAV — INyDES 2026 — GSD 5cm/px
6) Max zoom: 19

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"ortofoto_S1\RGB"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV — INyDES 2026 — GSD 5cm/px' })

ESTADISTICAS
------------
{
  "tiles": 1211,
  "bytes": 90507970,
  "per_zoom": {
    "15": 9,
    "16": 20,
    "17": 72,
    "18": 240,
    "19": 870
  },
  "zmax_natural": 8
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV — INyDES 2026 — GSD 5cm/px
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
