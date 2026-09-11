Visor de ortofoto: Ortofoto Seccion 3 Ba
Generado: 2026-09-11T08:36:59-0600
Origen:   F:\INYDES\Vuelos\Seccion3\Corte\Ortomosaico_Seccion_3_Ba.jp2

ESTRUCTURA
----------
F:\geoportal_chapultepec\visor_web_export\ortofoto_S3_Ba\RGB/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (15..19, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -99.228481, 19.408741
NE: -99.216351, 19.428064
Centro: -99.222416, 19.418403

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_chapultepec\visor_web_export\ortofoto_S3_Ba\RGB
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     Ortofoto Seccion 3 Ba
5) Attribution: Ortofoto UAV INyDES 2026 GSD 5cm/px Seccion 3 Ba
6) Max zoom: 19

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_chapultepec\visor_web_export\ortofoto_S3_Ba\RGB"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV INyDES 2026 GSD 5cm/px Seccion 3 Ba' })

ESTADISTICAS
------------
{
  "tiles": 768,
  "bytes": 15916951,
  "per_zoom": {
    "15": 6,
    "16": 15,
    "17": 45,
    "18": 144,
    "19": 558
  },
  "zmax_natural": 8
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV INyDES 2026 GSD 5cm/px Seccion 3 Ba
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
