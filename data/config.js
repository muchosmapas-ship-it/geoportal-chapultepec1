// config.js - Configuracion del visor
// Cache buster: bump en cada cambio de estructura

window.__CONFIG = {
    "BASE_LAYERS": {
        // =====================================================================
        // OVERVIEW (50cm/px) - z=13..17 - "ver TODO Chapultepec"
        // =====================================================================
        "seccion1_overview": {
            "attribution": "Ortofoto UAV INyDES 2026 S1 - overview 50cm/px",
            "label": "Ortofoto Seccion 1 (overview)",
            "maxZoom": 17,
            "minZoom": 13,
            "type": "xyz",
            "url": "./ortofoto_S1/RGB_overview/tiles/{z}/{x}/{y}.png?v=75"
        },
        "seccion2_overview": {
            "attribution": "Ortofoto UAV INyDES 2026 S2 - overview 50cm/px",
            "label": "Ortofoto Seccion 2 (overview)",
            "maxZoom": 17,
            "minZoom": 13,
            "type": "xyz",
            "url": "./ortofoto_S2/RGB_overview/tiles/{z}/{x}/{y}.png?v=75"
        },
        "seccion3_overview": {
            "attribution": "Ortofoto UAV INyDES 2026 S3 - overview 50cm/px",
            "label": "Ortofoto Seccion 3 (overview)",
            "maxZoom": 17,
            "minZoom": 13,
            "type": "xyz",
            "url": "./ortofoto_S3/RGB_overview/tiles/{z}/{x}/{y}.png?v=75"
        },
        "seccion3_barrilaco_overview": {
            "attribution": "Ortofoto UAV INyDES 2026 S3 Barrilaco - overview 50cm/px",
            "label": "Ortofoto Seccion 3 Barrilaco (overview)",
            "maxZoom": 17,
            "minZoom": 13,
            "type": "xyz",
            "url": "./ortofoto_S3_Ba/RGB_overview/tiles/{z}/{x}/{y}.png?v=75"
        },
        "seccion4_overview": {
            "attribution": "Ortofoto UAV INyDES 2026 S4 RGB - overview 50cm/px",
            "label": "Ortofoto Seccion 4 (overview)",
            "maxZoom": 17,
            "minZoom": 13,
            "type": "xyz",
            "url": "./ortofoto_S4/RGB_overview/tiles/{z}/{x}/{y}.png?v=75"
        },

        // =====================================================================
        // DETAIL (5cm/px) - z=18..21 - "zoom al detalle"
        // =====================================================================
        "seccion1_rgb": {
            "attribution": "Ortofoto UAV INyDES 2026 GSD 5cm/px (original 2.6cm)",
            "label": "Ortofoto Seccion 1",
            "maxZoom": 19,
            "minZoom": 15,
            "type": "xyz",
            "url": "./ortofoto_S1/RGB/tiles/{z}/{x}/{y}.png?v=75"
        },
        "seccion2_rgb": {
            "attribution": "Ortofoto UAV INyDES 2026 GSD 5cm/px Seccion 2",
            "label": "Ortofoto Seccion 2",
            "type": "xyz",
            "url": "./ortofoto_S2/RGB_clean/tiles/{z}/{x}/{y}.png?v=75",
            "minZoom": 13,
            "maxZoom": 19
        },
        "seccion3_rgb": {
            "attribution": "Ortofoto UAV INyDES 2026 GSD 5cm/px Seccion 3",
            "label": "Ortofoto Seccion 3",
            "type": "xyz",
            "url": "./ortofoto_S3/RGB/tiles/{z}/{x}/{y}.png?v=75",
            "minZoom": 15,
            "maxZoom": 19
        },
        "seccion3_barrilaco_rgb": {
            "attribution": "Ortofoto UAV INyDES 2026 GSD 5cm/px Seccion 3 Barrilaco",
            "label": "Ortofoto Seccion 3 Barrilaco",
            "type": "xyz",
            "url": "./ortofoto_S3_Ba/RGB/tiles/{z}/{x}/{y}.png?v=75",
            "minZoom": 15,
            "maxZoom": 19
        },
        "rgb": {
            "attribution": "Ortofoto UAV - INyDES 2026 - GSD 5cm/px",
            "label": "Ortofoto Seccion 4",
            "maxZoom": 19,
            "minZoom": 15,
            "type": "xyz",
            "url": "./ortofoto_S4/RGB/tiles/{z}/{x}/{y}.png?v=75"
        },
        "osm": {
            "attribution": "(c) OpenStreetMap contributors",
            "label": "Mapa base - OpenStreetMap",
            "type": "osm"
        }
    },
    "CENTER": [-99.2072, 19.4081],
    "DEFAULT_BASE_LAYERS": [
        "seccion1_overview",
        "seccion1_rgb",
        "seccion2_overview",
        "seccion2_rgb",
        "seccion3_overview",
        "seccion3_rgb",
        "seccion3_barrilaco_overview",
        "seccion3_barrilaco_rgb",
        "seccion4_overview",
        "rgb",
        "osm"
    ],
    "EXTENTS": {
        "all_subzonas": [
            -99.238,
            19.3864,
            -99.176,
            19.4297
        ],
        "cdmx": [
            -99.3,
            19.3,
            -99.05,
            19.55
        ],
        "s4": [
            -99.2384,
            19.3865,
            -99.223,
            19.3941
        ]
    },
    "MAX_ZOOM": 21,
    "MIN_ZOOM": 13,
    "OVERLAY_LAYERS": {
        "s1_vegetacion_5clases": {
            "color": "#38a800",
            "label": "Vigor del Dosel Vegetal (Sección 1)",
            "url": "./data/S1_Vegetacion_5Clases_Ligero.geojson?v=7",
            "shpZipUrl": "./data/descargas_shp/Vigor_Vegetacion_S1_Shapefile.zip?v=7",
            "visible": true,
            "showLabels": false,
            "zIndex": 60
        },
        "subzonas": {
            "color": "#1e88e5",
            "label": "Subzonas del Bosque",
            "url": "./data/subzonas.geojson?v=75",
            "shpZipUrl": "./data/descargas_shp/Subzonas_Bosque_Chapultepec_Shapefile.zip",
            "visible": false
        }
    },
    "ZOOM": 13.6
};
