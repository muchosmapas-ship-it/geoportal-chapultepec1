Visor de ortofoto: 🟢 RGB Parque Libano (S1)
Generado: 2026-09-09T17:22:41-0600
Origen:   F:\INYDES\Vuelos\seccion1\Ortomosaico_P_Líbano_Peri_Memorial\Ortofoto seccion 1 parque.tif

ESTRUCTURA
----------
ortofoto_S1\Parque_Ortofotoseccion1parque/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (18..19, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -99.203020, 19.423107
NE: -99.197482, 19.429601
Centro: -99.200251, 19.426354

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd ortofoto_S1\Parque_Ortofotoseccion1parque
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     🟢 RGB Parque Libano (S1)
5) Attribution: Ortofoto UAV — INyDES 2026 — GSD 5cm/px — Parque L\u00edbano
6) Max zoom: 19

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"ortofoto_S1\Parque_Ortofotoseccion1parque"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV — INyDES 2026 — GSD 5cm/px — Parque L\u00edbano' })

ESTADISTICAS
------------
{
  "tiles": 129,
  "bytes": 7043083,
  "per_zoom": {
    "18": 30,
    "19": 99
  },
  "zmax_natural": 6
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV — INyDES 2026 — GSD 5cm/px — Parque L\u00edbano
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
