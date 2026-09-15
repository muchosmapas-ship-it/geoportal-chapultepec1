    const customAttribution = `&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors<hr style="margin:6px 0;border-color:rgba(0,0,0,0.15);"><strong style="color:#1b4d3e;">Universidad Abierta y a Distancia de México</strong><br><small style="color:#475569;font-weight:600;">DIVISIÓN DE CIENCIAS SOCIALES Y ADMINISTRATIVAS</small><br><strong>Gestión Territorial</strong><br><br><span style="color:#334155;">Análisis integral del estado del arbolado en el Bosque de Chapultepec mediante drones para fortalecer la gestión territorial y la conservación de áreas verdes urbanas</span><br><br><strong style="color:#133c2e;">EDGAR LÓPEZ PÉREZ</strong> (<a href="mailto:jhonson2490@gmail.com">jhonson2490@gmail.com</a>)`;
// app.js - Visor estatico del Geoportal Chapultepec
// OpenLayers 3 + Bootstrap 5, sin build step, sin backend.

(function () {
    'use strict';

    const CFG = window.__CONFIG;
    const map = window.__map = new ol.Map({
        target: 'map',
        layers: [],
        view: new ol.View({
            projection: 'EPSG:3857',
            center: ol.proj.fromLonLat(CFG.CENTER),
            zoom: CFG.ZOOM,
            minZoom: CFG.MIN_ZOOM,
            maxZoom: CFG.MAX_ZOOM
        }),
        controls: ol.control.defaults({ attribution: false }).extend([
            new ol.control.Attribution({
                collapsible: true,
                collapsed: true
            })
        ])
            .extend([new ol.control.ScaleLine()])
            .extend([new ol.control.MousePosition({
                coordinateFormat: ol.coordinate.createStringXY(5),
                projection: 'EPSG:4326'
            })])
    });
    console.log('[visor] iniciando');

    // =====================================================================
    // CAPAS BASE: orden de render y conmutacion inteligente 50cm <-> 5cm
    //   - OSM primero (queda al fondo, zIndex=1)
    //   - Overview (50cm/px, zIndex=10, activo en zoom < 17.5)
    //   - Detalle (5cm/px, zIndex=20, activo en zoom >= 17.5)
    // =====================================================================
    const baseLayers = {};
    const userEnabledBases = {};
    const defaultList = CFG.DEFAULT_BASE_LAYERS || ['osm', 'rgb'];
    const DETAIL_ZOOM_THRESHOLD = 17.5; // Punto de corte entre Panoramica 50cm y Detalle 5cm

    // Pares sincronizados [detalle, overview]
    const PAIRS = [
        ['seccion1_rgb', 'seccion1_overview'],
        ['seccion2_rgb', 'seccion2_overview'],
        ['seccion3_rgb', 'seccion3_overview'],
        ['seccion3_barrilaco_rgb', 'seccion3_barrilaco_overview'],
        ['rgb', 'seccion4_overview'],
        ['salud', 'salud_overview'],
    ];
    const DETAIL_TO_OVERVIEW = {};
    const OVERVIEW_TO_DETAIL = {};
    for (const [d, o] of PAIRS) {
        if (CFG.BASE_LAYERS[d] && CFG.BASE_LAYERS[o]) {
            DETAIL_TO_OVERVIEW[d] = o;
            OVERVIEW_TO_DETAIL[o] = d;
        }
    }

    // Inicializar estado de seleccion del usuario
    for (const name of Object.keys(CFG.BASE_LAYERS)) {
        if (!name.endsWith('_overview')) {
            const isDef = defaultList.includes(name) || (DETAIL_TO_OVERVIEW[name] && defaultList.includes(DETAIL_TO_OVERVIEW[name]));
            userEnabledBases[name] = isDef;
            const ov = DETAIL_TO_OVERVIEW[name];
            if (ov) userEnabledBases[ov] = isDef;
        }
    }

    // Crear capas OpenLayers con zIndex y min/maxZoom de proteccion
    const baseEntries = Object.entries(CFG.BASE_LAYERS);
    for (const [name, info] of baseEntries) {
        let source;
        let zIndex = 5;
        if (info.type === 'osm') {
            source = new ol.source.OSM({
                attributions: [customAttribution]
            });
            zIndex = 1;
        } else if (info.type === 'xyz') {
            const isOverview = name.endsWith('_overview');
            zIndex = isOverview ? 10 : 20;
            const maxZ = isOverview ? 17 : 19;
            const minZ = isOverview ? 13 : 15;
            source = new ol.source.XYZ({
                url: info.url,
                minZoom: minZ,
                maxZoom: maxZ,
                attributions: [customAttribution]
            });
        }
        const layer = new ol.layer.Tile({ source, zIndex });
        layer.set('name', name);
        layer.setVisible(false); // Inicialmente false; syncBaseLayersVisibility lo ajusta
        baseLayers[name] = layer;
        map.addLayer(layer);
    }

    // Funcion central para conmutar overview (50cm) vs detalle (5cm) segun el zoom actual
    function syncBaseLayersVisibility() {
        const zoom = map.getView().getZoom() || CFG.ZOOM;
        const isDetail = zoom >= DETAIL_ZOOM_THRESHOLD;

        for (const [detailName, overviewName] of PAIRS) {
            const enabled = !!userEnabledBases[detailName];
            if (baseLayers[overviewName]) {
                baseLayers[overviewName].setVisible(enabled && !isDetail);
            }
            if (baseLayers[detailName]) {
                baseLayers[detailName].setVisible(enabled && isDetail);
            }
        }
        if (baseLayers['osm']) {
            baseLayers['osm'].setVisible(!!userEnabledBases['osm']);
        }

        const badge = document.getElementById('ortho-mode-badge');
        if (badge) {
            badge.style.display = 'none';
            badge.innerHTML = '';
        }
    }

    map.getView().on('change:resolution', syncBaseLayersVisibility);
    map.on('moveend', syncBaseLayersVisibility);

    function toggleBase(name, on) {
        userEnabledBases[name] = on;
        const overview = DETAIL_TO_OVERVIEW[name];
        if (overview) {
            userEnabledBases[overview] = on;
        } else if (OVERVIEW_TO_DETAIL[name]) {
            userEnabledBases[OVERVIEW_TO_DETAIL[name]] = on;
        }
        syncBaseLayersVisibility();
    }

    function setAllBases(on) {
        for (const k of Object.keys(userEnabledBases)) {
            userEnabledBases[k] = on;
        }
        document.querySelectorAll('input[id^=base-]').forEach(c => c.checked = on);
        syncBaseLayersVisibility();
    }

    syncBaseLayersVisibility();

    // =====================================================================
    // OVERLAYS: subzonas (vector) y arboles (heatmap + puntos)
    // =====================================================================
    const overlays = {};
    for (const [name, info] of Object.entries(CFG.OVERLAY_LAYERS)) {
        if (name === 'arboles') {
            loadArbolesCluster(info);
        } else {
            fetch(info.url)
                .then(r => {
                    if (!r.ok) return Promise.reject('HTTP ' + r.status);
                    return r.json();
                })
                .then(data => {
                    if (!data || !data.features) {
                        console.warn(`[visor] ${name}: sin data/features`);
                        return;
                    }
                    // Strip CRS84 URN: OL 3.20.1 no reconoce urn:ogc:def:crs:OGC:1.3:CRS84
                    if (data.crs && data.crs.properties && /CRS84/i.test(data.crs.properties.name || '')) {
                        delete data.crs;
                    }
                    const features = new ol.format.GeoJSON().readFeatures(data, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    if (features.length === 0) {
                        console.warn(`[visor] ${name}: 0 features leidas`);
                        return;
                    }
                    // Estilo con etiqueta del nombre de la subzona
                    const labelStyle = new ol.style.Style({
                        fill: new ol.style.Fill({ color: hexToRgba(info.color, 0.30) }),
                        stroke: new ol.style.Stroke({ color: info.color, width: 2 }),
                        text: new ol.style.Text({
                            text: '',  // se asigna en style function
                            font: 'bold 13px sans-serif',
                            fill: new ol.style.Fill({ color: '#1b4d3e' }),
                            stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.85)', width: 3 }),
                            overflow: true,
                            offsetY: 0,
                        })
                    });
                    const layer = new ol.layer.Vector({
                        source: new ol.source.Vector({ features }),
                        style: (feature, resolution) => {
                            const nombre = feature.get('nombre') || '';
                            const subzona = feature.get('subzona') || '';
                            // Mostrar etiqueta solo en zooms altos (z>=15) o nombres cortos
                            const showLabel = resolution < 16 || nombre.length < 25;
                            labelStyle.getText().setText(
                                showLabel ? `${subzona ? subzona + ' ' : ''}${nombre}` : ''
                            );
                            return labelStyle;
                        },
                        zIndex: 100  // Encima de TODAS las ortofotos
                    });
                    layer.set('name', name);
                    layer.setVisible(info.visible !== false);
                    map.addLayer(layer);
                    overlays[name] = { layer, info, features };
                    renderLayersPanel();
                })
                .catch(e => {
                    console.error(`[visor] overlay ${name} no cargado:`, e);
                    const err = document.getElementById('arboles-status');
                    if (err) err.textContent = `Error cargando ${name}: ${e && e.message ? e.message : e}`;
                });
        }
    }

    // ----- Capa de arboles con cluster -----
    function loadArbolesCluster(info) {
        const stats = document.getElementById('arboles-status');
        if (stats) stats.textContent = 'Cargando 67,475 arboles...';
        fetch(info.url)
            .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
            .then(data => {
                if (!data || !data.features) return;
                if (data.crs && data.crs.properties && /CRS84/i.test(data.crs.properties.name || '')) {
                    delete data.crs;
                }
                const features = new ol.format.GeoJSON().readFeatures(data, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
                const vectorSource = new ol.source.Vector({ features });
                const clusterSource = new ol.source.Cluster({
                    distance: info.clusterDistance || 50,
                    source: vectorSource,
                });
                const layer = new ol.layer.Vector({
                    source: clusterSource,
                    style: clusterStyle,
                    zIndex: 101  // Encima de subzonas (zIndex=100)
                });
                layer.set('name', 'arboles');
                layer.setVisible(info.visible !== false);
                map.addLayer(layer);
                overlays['arboles'] = {
                    layer, info, features,
                    rawCount: features.length
                };
                renderLayersPanel();
                if (stats) stats.textContent = `Cargados: ${features.length.toLocaleString()} arboles`;
            })
            .catch(e => {
                console.error('[visor] arboles no cargado:', e);
                if (stats) stats.textContent = `ERROR: ${e && e.message ? e.message : e}`;
            });
    }

    function clusterStyle(feature) {
        const features = feature.get('features') || [];
        const size = features.length;

        // Si la concentracion es de 1 a 20 arboles, mostrar TODOS los puntos individuales
        if (size <= 20) {
            const styles = [];
            for (let i = 0; i < size; i++) {
                const geom = features[i].getGeometry();
                if (geom) {
                    styles.push(new ol.style.Style({
                        geometry: geom,
                        image: new ol.style.Circle({
                            radius: 5,
                            fill: new ol.style.Fill({ color: '#2e7d32' }), // Verde bosque intenso
                            stroke: new ol.style.Stroke({ color: '#ffffff', width: 1.5 })
                        })
                    }));
                }
            }
            return styles;
        }

        // Para concentraciones mayores a 20 (>20), mostrar agrupacion graduada por color
        let color, radius, textColor;
        if (size <= 100) {
            color = 'rgba(255, 193, 7, 0.90)';   // Amarillo / ?mbar (21-100)
            radius = 13;
            textColor = '#212529';
        } else if (size <= 500) {
            color = 'rgba(255, 152, 0, 0.92)';   // Naranja C?lido (101-500)
            radius = 16;
            textColor = '#ffffff';
        } else if (size <= 1500) {
            color = 'rgba(244, 67, 54, 0.95)';   // Rojo Coral (501-1500)
            radius = 20;
            textColor = '#ffffff';
        } else {
            color = 'rgba(183, 28, 28, 0.96)';  // Rojo Carm?n Oscuro (>1500)
            radius = 24;
            textColor = '#ffffff';
        }

        const labelText = size > 999 ? (size / 1000).toFixed(1) + 'k' : size.toString();

        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: radius,
                fill: new ol.style.Fill({ color: color }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            }),
            text: new ol.style.Text({
                text: labelText,
                fill: new ol.style.Fill({ color: textColor }),
                font: size > 999 ? 'bold 11px sans-serif' : (radius > 15 ? 'bold 12px sans-serif' : '11px sans-serif')
            })
        });
    }

    // =====================================================================
    // CAPA DE HIGHLIGHT (resaltado amarillo) - sincronizada con la tabla
    // =====================================================================
    const highlightSource = new ol.source.Vector();
    const highlightLayer = new ol.layer.Vector({
        source: highlightSource,
        style: new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(82, 183, 136, 0.40)' }),  // amarillo semi-transparente
            stroke: new ol.style.Stroke({ color: '#1b4d3e', width: 4 }),
            image: new ol.style.Circle({
                radius: 10,
                fill: new ol.style.Fill({ color: 'rgba(45, 106, 79, 0.70)' }),
                stroke: new ol.style.Stroke({ color: '#d97706', width: 3 })
            })
        }),
        zIndex: 200  // Por encima de overlays (100/101)
    });
    map.addLayer(highlightLayer);

    // Feature actualmente seleccionada: { feature, layerName, sourceId }
    let currentSelection = null;

    function clearHighlight() {
        highlightSource.clear();
        // Quitar clase selected de TODAS las filas de tabla
        document.querySelectorAll('.attr-table tr.attr-selected').forEach(r => r.classList.remove('attr-selected'));
        currentSelection = null;
    }

    function highlightFeature(feature, layerName, sourceId) {
        clearHighlight();
        if (!feature) return;
        // Clonar la feature para que tenga su propia referencia
        let geom;
        if (feature.getGeometry) {
            geom = feature.getGeometry();
        } else if (feature.geometry) {
            geom = new ol.format.GeoJSON().readGeometry(feature.geometry);
        }
        if (!geom) return;
        const highlightFeat = new ol.Feature({ geometry: geom });
        // Copiar propiedades (util para popup/info-panel)
        const props = feature.getProperties ? feature.getProperties() : (feature.properties || {});
        Object.keys(props).forEach(k => {
            if (k !== 'geometry') highlightFeat.set(k, props[k]);
        });
        highlightSource.addFeature(highlightFeat);
        currentSelection = { feature, layerName, sourceId, highlightedFeature: highlightFeat };
        // Si la tabla del bottom panel esta abierta y el feature esta en la lista, marcar su fila
        syncTableSelection(sourceId);
    }

    function syncTableSelection(sourceId) {
        if (!bottomPanelState.open) return;
        if (bottomPanelState.layerName !== sourceId && currentSelection?.layerName !== sourceId) return;
        const wrap = document.getElementById('attr-panel-wrap');
        if (!wrap) return;
        const rows = wrap.querySelectorAll('tbody tr');
        rows.forEach(tr => {
            const fidx = parseInt(tr.dataset.fidx);
            const f = filteredFor(bottomPanelState)[fidx];
            const isCurrent = f && currentSelection &&
                JSON.stringify(f.getGeometry ? f.getGeometry().getCoordinates() : null) ===
                JSON.stringify(currentSelection.feature.getGeometry ? currentSelection.feature.getGeometry().getCoordinates() : null);
            if (isCurrent) {
                tr.classList.add('attr-selected');
                tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    // (clusterStyle eliminado: ya no se usa con heatmap)

    // =====================================================================
    // SIDEBAR: capas base (checkbox), overlays (checkbox), bulk ON/OFF
    // =====================================================================
        function renderLayersPanel() {
        const basePanel = document.getElementById('base-panel');
        if (basePanel) {
            basePanel.innerHTML = `
                <div class="mb-1">
                    <small class="text-muted fw-semibold">Mapas base:</small>
                </div>
                ${Object.entries(CFG.BASE_LAYERS)
                    .filter(([n, i]) => !n.endsWith('_overview'))
                    .map(([n, i]) => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="base-${n}" ${userEnabledBases[n] ? 'checked' : ''}>
                        <label class="form-check-label" for="base-${n}" style="font-size:0.85rem;cursor:pointer" data-layer-type="base" data-layer-name="${n}" title="Click derecho para opciones">${escapeHtml(i.label)}</label>
                    </div>`).join('')}
            `;
            basePanel.querySelectorAll('input[id^=base-]').forEach(c => {
                c.addEventListener('change', e => toggleBase(e.target.id.replace('base-',''), e.target.checked));
            });
            document.getElementById('bases-all-on')?.addEventListener('click', () => setAllBases(true));
            document.getElementById('bases-all-off')?.addEventListener('click', () => setAllBases(false));
        }
        const ovPanel = document.getElementById('overlay-panel');
        if (ovPanel) {
            ovPanel.innerHTML = `
                <div class="mb-1">
                    <small class="text-muted fw-semibold">Capas superpuestas:</small>
                </div>
                
                ${Object.entries(CFG.OVERLAY_LAYERS).map(([name, info]) => `
                    <div class="d-flex align-items-center justify-content-between my-1 p-1 rounded border-bottom" style="background:rgba(255,255,255,0.7)">
                        <div class="form-check mb-0 me-2">
                            <input class="form-check-input" type="checkbox" id="ov-${name}" ${overlays[name]?.layer.getVisible() ? 'checked' : ''}>
                            <label class="form-check-label fw-semibold" for="ov-${name}" style="font-size:0.85rem;cursor:pointer" data-layer-type="overlay" data-layer-name="${name}" title="Click derecho para opciones">${escapeHtml(info.label)}</label>
                        </div>
                        <button class="btn btn-sm btn-outline-primary py-0 px-2 btn-open-table" data-layer="${name}" title="Ver tabla de atributos de ${escapeHtml(info.label)}">
                            📊 Tabla
                        </button>
                    </div>
                    ` + (name === 'arboles' ? `<div class="mt-1 mb-2 p-2 rounded border p-2" style="font-size:10px; line-height: 1.2;">
                        <div style="font-weight: bold; margin-bottom: 4px; color: #333;">Concentración de árboles:</div>
                        <div class="d-flex align-items-center justify-content-between text-center">
                            <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2e7d32;border:1px solid #fff;"></span><br><span style="font-size:9px;color:#555;">1-20</span></div>
                            <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:rgba(255, 193, 7, 0.9);border:1px solid #fff;"></span><br><span style="font-size:9px;color:#555;">21-100</span></div>
                            <div><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:rgba(255, 152, 0, 0.9);border:1px solid #fff;"></span><br><span style="font-size:9px;color:#555;">101-500</span></div>
                            <div><span style="display:inline-block;width:15px;height:15px;border-radius:50%;background:rgba(244, 67, 54, 0.9);border:1px solid #fff;"></span><br><span style="font-size:9px;color:#555;">501-1.5k</span></div>
                            <div><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:rgba(183, 28, 28, 0.96);border:1px solid #fff;"></span><br><span style="font-size:9px;color:#555;">&gt;1.5k</span></div>
                        </div>
                    </div>` : '')).join('')}
            `;
            ovPanel.querySelectorAll('input[id^=ov-]').forEach(c => {
                c.addEventListener('change', e => {
                    const name = c.id.replace('ov-', '');
                    const o = overlays[name];
                    if (o) o.layer.setVisible(e.target.checked);
                });
            });
            ovPanel.querySelectorAll('.btn-open-table').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const layerName = btn.dataset.layer;
                    openBottomPanel(layerName);
                });
            });
            document.getElementById('ovs-all-on')?.addEventListener('click', () => {
                for (const [n, o] of Object.entries(overlays)) {
                    o.layer.setVisible(true);
                }
                ovPanel.querySelectorAll('input[id^=ov-]').forEach(c => c.checked = true);
            });
            document.getElementById('ovs-all-off')?.addEventListener('click', () => {
                for (const [n, o] of Object.entries(overlays)) {
                    o.layer.setVisible(false);
                }
                ovPanel.querySelectorAll('input[id^=ov-]').forEach(c => c.checked = false);
            });
        }

        document.querySelectorAll('[data-layer-name]').forEach(el => {
            el.addEventListener('contextmenu', e => {
                e.preventDefault();
                const type = el.dataset.layerType || 'overlay';
                const name = el.dataset.layerName;
                showLayerContextMenu(e, type, name);
            });
        });
    }
    // Renderizar paneles de capas inmediatamente al inicio
    renderLayersPanel();

    let activeContextMenu = null;
    function hideContextMenu() {
        if (activeContextMenu) {
            activeContextMenu.remove();
            activeContextMenu = null;
        }
    }
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideContextMenu(); });

    function showLayerContextMenu(evt, type, name) {
        hideContextMenu();
        const menu = document.createElement('div');
        menu.className = 'layer-context-menu';
        const isOverlay = type === 'overlay';
        const labelName = isOverlay
            ? (CFG.OVERLAY_LAYERS[name]?.label || name)
            : (CFG.BASE_LAYERS[name]?.label || name);
        menu.innerHTML = `
            <div class="layer-ctx-header">${escapeHtml(labelName)}</div>
            ${isOverlay
                ? `<button data-action="table">Ver tabla de atributos</button>`
                : `<button data-action="info" disabled style="opacity:.5;cursor:not-allowed">Sin atributos (raster)</button>`
            }
            <button data-action="zoom">Zoom al extent</button>
            <button data-action="toggle">${isOverlay ? 'Alternar visibilidad' : 'Alternar'}</button>
        `;
        // Posicion cerca del click pero dentro del viewport
        let x = evt.clientX;
        let y = evt.clientY;
        menu.style.position = 'fixed';
        menu.style.left = '0px';
        menu.style.top = '0px';
        document.body.appendChild(menu);
        const r = menu.getBoundingClientRect();
        if (x + r.width > window.innerWidth) x = window.innerWidth - r.width - 4;
        if (y + r.height > window.innerHeight) y = window.innerHeight - r.height - 4;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        activeContextMenu = menu;

        menu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const action = btn.dataset.action;
                hideContextMenu();
                if (action === 'table') openBottomPanel(name);
                else if (action === 'zoom') zoomToLayerExtent(name, type);
                else if (action === 'toggle') {
                    if (type === 'base') {
                        const newState = !userEnabledBases[name];
                        toggleBase(name, newState);
                        const cb = document.getElementById(`base-${name}`);
                        if (cb) cb.checked = newState;
                    } else {
                        const o = overlays[name];
                        if (o) o.layer.setVisible(!o.layer.getVisible());
                        const cb = document.getElementById(`ov-${name}`);
                        if (cb) cb.checked = o.layer.getVisible();
                    }
                }
            });
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    function zoomToLayerExtent(name, type) {
        let src;
        if (type === 'overlay') {
            const o = overlays[name];
            if (!o) return;
            src = o.layer.getSource();
        } else {
            const l = baseLayers[name];
            if (!l) return;
            src = l.getSource();
        }
        // Tile sources (XYZ/OSM) no dan extent preciso, usamos el extent global
        if (src instanceof ol.source.XYZ || src instanceof ol.source.OSM) {
            map.getView().setCenter(ol.proj.fromLonLat(CFG.CENTER));
            map.getView().setZoom(CFG.MIN_ZOOM + 2);
            return;
        }
        const ext = src.getExtent && src.getExtent();
        if (ext && isFinite(ext[0])) {
            map.getView().fit(ext, { padding: [40, 40, 40, 40], maxZoom: 19, duration: 800 });
        }
    }

    // =====================================================================
    // PANEL INFERIOR: Tabla persistente de atributos
    // =====================================================================
    let bottomPanel = null;
    let bottomPanelState = { open: false, height: 280, layerName: null, allFeatures: [], cols: [], filter: '', page: 0, sortCol: null, sortDir: 1, layerColor: '#1b4d3e', layerLabel: '' };

    function openBottomPanel(layerName) {
        const o = overlays[layerName];
        if (!o) return;
        const features = o.features || [];
        if (features.length === 0) {
            alert('Esta capa no tiene features con atributos.');
            return;
        }
        const info = o.info;
        bottomPanelState.layerName = layerName;
        bottomPanelState.allFeatures = features;
        bottomPanelState.layerLabel = info.label || layerName;
        bottomPanelState.layerColor = info.color || '#1b4d3e';
        bottomPanelState.filter = '';
        bottomPanelState.page = 0;
        bottomPanelState.sortCol = null;
        bottomPanelState.sortDir = 1;

        // Detectar columnas
        const colSet = new Set();
        for (const f of features) {
            const props = f.getProperties ? f.getProperties() : (f.properties || {});
            for (const k of Object.keys(props)) {
                if (k === 'geometry') continue;
                colSet.add(k);
            }
        }
        const cols = Array.from(colSet).sort((a, b) => {
            const aKey = (a === 'id' || a === 'gid' || a === 'subzona');
            const bKey = (b === 'id' || b === 'gid' || b === 'subzona');
            if (aKey && !bKey) return -1;
            if (bKey && !aKey) return 1;
            return a.localeCompare(b);
        });
        bottomPanelState.cols = cols;

        // Crear panel si no existe
        if (!bottomPanel) {
            bottomPanel = document.createElement('div');
            bottomPanel.id = 'attr-panel';
            bottomPanel.className = 'attr-panel';
            document.body.appendChild(bottomPanel);

            // Handle de resize (drag top edge)
            const handle = document.createElement('div');
            handle.className = 'attr-panel-resize';
            handle.title = 'Arrastrar para redimensionar';
            bottomPanel.appendChild(handle);
            let dragging = false, startY = 0, startH = 0;
            handle.addEventListener('mousedown', e => {
                dragging = true;
                startY = e.clientY;
                startH = bottomPanel.offsetHeight;
                document.body.style.cursor = 'ns-resize';
                e.preventDefault();
            });
            document.addEventListener('mousemove', e => {
                if (!dragging) return;
                const dy = startY - e.clientY;
                let newH = Math.max(120, Math.min(window.innerHeight * 0.85, startH + dy));
                bottomPanel.style.height = newH + 'px';
                bottomPanelState.height = newH;
                // Re-fit map
                setTimeout(() => map.updateSize(), 0);
            });
            document.addEventListener('mouseup', () => {
                if (dragging) {
                    dragging = false;
                    document.body.style.cursor = '';
                }
            });
        }

        bottomPanel.innerHTML = `
            <div class="attr-panel-header" style="border-top:3px solid ${escapeHtml(bottomPanelState.layerColor)}">
                <div class="d-flex align-items-center">
                    <span class="attr-layer-badge" style="background:${escapeHtml(bottomPanelState.layerColor)}">${escapeHtml(bottomPanelState.layerLabel)}</span>
                    <small class="ms-3 text-white-50" id="attr-panel-count">${features.length.toLocaleString()} features</small>
                </div>
                <div class="d-flex align-items-center">
                    <div class="input-group input-group-sm me-2" style="max-width:280px">
                        <span class="input-group-text bg-white" style="padding:0 6px">🔍</span>
                        <input type="text" id="attr-panel-filter" class="form-control form-control-sm" placeholder="Filtrar en cualquier columna...">
                        <button class="btn btn-outline-secondary btn-sm" id="attr-panel-filter-clear" title="Limpiar filtro" type="button">×</button>
                    </div>
                    <div class="me-2">
                        <button class="btn btn-sm btn-outline-light" id="attr-panel-first" title="Primera página">«</button>
                        <button class="btn btn-sm btn-outline-light" id="attr-panel-prev">‹</button>
                        <span class="text-white mx-1 small" id="attr-panel-page">1/1</span>
                        <button class="btn btn-sm btn-outline-light" id="attr-panel-next">›</button>
                        <button class="btn btn-sm btn-outline-light" id="attr-panel-last" title="Última página">»</button>
                    </div>
                    <button class="btn btn-sm btn-outline-light me-2" id="attr-panel-csv" title="Descargar CSV"><span style="font-size:1.05em">⬇</span> CSV</button>
                    <button class="btn btn-sm btn-light me-2" id="attr-panel-minimize" title="Minimizar/Maximizar">▼</button>
                    <button class="btn-close btn-close-white" id="attr-panel-close" title="Cerrar panel" aria-label="Close"></button>
                </div>
            </div>
            <div id="attr-panel-wrap" class="attr-panel-wrap"></div>
        `;

        bottomPanel.style.height = bottomPanelState.height + 'px';
        bottomPanel.classList.add('open');
        bottomPanelState.open = true;
        document.body.classList.add('attr-panel-active');
        // Forzar al mapa a recalcular su tamano
        setTimeout(() => map.updateSize(), 220);

        renderPanelTable();

        // Event handlers
        document.getElementById('attr-panel-filter').addEventListener('input', e => {
            bottomPanelState.filter = e.target.value;
            bottomPanelState.page = 0;
            renderPanelTable();
        });
        document.getElementById('attr-panel-filter-clear').addEventListener('click', () => {
            document.getElementById('attr-panel-filter').value = '';
            bottomPanelState.filter = '';
            bottomPanelState.page = 0;
            renderPanelTable();
        });
        document.getElementById('attr-panel-first').addEventListener('click', () => { bottomPanelState.page = 0; renderPanelTable(); });
        document.getElementById('attr-panel-prev').addEventListener('click', () => { bottomPanelState.page--; renderPanelTable(); });
        document.getElementById('attr-panel-next').addEventListener('click', () => { bottomPanelState.page++; renderPanelTable(); });
        document.getElementById('attr-panel-last').addEventListener('click', () => {
            const st = bottomPanelState;
            const totalPages = Math.max(1, Math.ceil(filteredFor(st).length / 100));
            st.page = totalPages - 1;
            renderPanelTable();
        });
        document.getElementById('attr-panel-csv').addEventListener('click', () => {
            const st = bottomPanelState;
            exportPanelCSV(st);
        });
        document.getElementById('attr-panel-close').addEventListener('click', closeBottomPanel);
        document.getElementById('attr-panel-minimize').addEventListener('click', () => {
            const isOpen = bottomPanel.classList.contains('open');
            if (isOpen) {
                bottomPanel.classList.remove('open');
                bottomPanel.style.height = '40px';
                setTimeout(() => map.updateSize(), 220);
            } else {
                bottomPanel.classList.add('open');
                bottomPanel.style.height = bottomPanelState.height + 'px';
                setTimeout(() => map.updateSize(), 220);
            }
        });
    }

    function closeBottomPanel() {
        if (!bottomPanel) return;
        bottomPanel.classList.remove('open');
        bottomPanelState.open = false;
        document.body.classList.remove('attr-panel-active');
        setTimeout(() => map.updateSize(), 220);
    }

    function getPropsForPanel(f) {
        const props = f.getProperties ? f.getProperties() : (f.properties || {});
        const clean = {};
        for (const k of Object.keys(props)) {
            if (k === 'geometry' || k.startsWith('_')) continue;
            clean[k] = props[k];
        }
        return clean;
    }

    function filteredFor(st) {
        if (!st.filter) return st.allFeatures;
        const term = st.filter.toLowerCase();
        return st.allFeatures.filter(f => {
            const props = getPropsForPanel(f);
            return Object.values(props).some(val => {
                if (val == null) return false;
                return String(val).toLowerCase().includes(term);
            });
        });
    }

    function sortForPanel(arr) {
        const st = bottomPanelState;
        if (!st.sortCol) return arr;
        const dir = st.sortDir;
        return arr.slice().sort((a, b) => {
            let va = getPropsForPanel(a)[st.sortCol];
            let vb = getPropsForPanel(b)[st.sortCol];
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            const na = Number(va), nb = Number(vb);
            if (!isNaN(na) && !isNaN(nb)) return dir * (na - nb);
            return dir * String(va).localeCompare(String(vb));
        });
    }

    function renderPanelTable() {
        const st = bottomPanelState;
        if (!st.allFeatures) return;
        const PAGE = 100;
        let filtered = filteredFor(st);
        filtered = sortForPanel(filtered);
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
        if (st.page >= totalPages) st.page = totalPages - 1;
        if (st.page < 0) st.page = 0;
        const start = st.page * PAGE;
        const pageItems = filtered.slice(start, start + PAGE);

        document.getElementById('attr-panel-count').textContent =
            `${st.allFeatures.length.toLocaleString()} features${st.filter ? ' (filtrado)' : ''}`;
        document.getElementById('attr-panel-page').textContent = `${st.page + 1}/${totalPages}`;
        document.getElementById('attr-panel-first').disabled = st.page === 0;
        document.getElementById('attr-panel-prev').disabled = st.page === 0;
        document.getElementById('attr-panel-next').disabled = st.page >= totalPages - 1;
        document.getElementById('attr-panel-last').disabled = st.page >= totalPages - 1;

        let html = '<table class="attr-table"><thead><tr>';
        html += '<th class="attr-rownum">#</th>';
        for (const c of st.cols) {
            const arrow = st.sortCol === c ? (st.sortDir === 1 ? ' ▲' : ' ▼') : '';
            html += `<th class="sortable" data-col="${escapeHtml(c)}">${escapeHtml(c)}${arrow}</th>`;
        }
        html += '</tr></thead><tbody>';
        for (let i = 0; i < pageItems.length; i++) {
            const f = pageItems[i];
            const props = getPropsForPanel(f);
            const fid = f.getId ? f.getId() : ('idx-' + (start + i));
            html += `<tr data-fidx="${start + i}" data-fid="${escapeHtml(String(fid))}" title="Click para hacer zoom al feature">`;
            html += `<td class="attr-rownum">${start + i + 1}</td>`;
            for (const c of st.cols) {
                const v = props[c];
                let display, cls = '';
                if (v === null || v === undefined) {
                    display = '—';
                    cls = 'attr-null';
                } else if (typeof v === 'object') {
                    display = escapeHtml(JSON.stringify(v));
                    cls = 'attr-obj';
                } else {
                    display = escapeHtml(String(v));
                }
                html += `<td class="${cls}" title="${escapeHtml(String(v))}">${display}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        document.getElementById('attr-panel-wrap').innerHTML = html;

        // Click handlers
        document.getElementById('attr-panel-wrap').querySelectorAll('tbody tr').forEach(tr => {
            tr.addEventListener('click', () => {
                const fidx = parseInt(tr.dataset.fidx);
                const f = filtered[fidx];
                const geom = f.getGeometry ? f.getGeometry() : (f.geometry ? new ol.format.GeoJSON().readGeometry(f.geometry) : null);
                if (geom) {
                    // Marcar fila como seleccionada
                    document.querySelectorAll('.attr-table tr.attr-selected').forEach(r => r.classList.remove('attr-selected'));
                    tr.classList.add('attr-selected');
                    // Zoom al feature
                    const ext = geom.getExtent ? geom.getExtent() : ol.extent.boundingExtent([geom.getCoordinates()]);
                    if (ext && isFinite(ext[0])) {
                        map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 19, duration: 500 });
                    }
                    // Resaltar en el mapa (capa highlight amarilla)
                    highlightFeature(f, st.layerName, st.layerName);
                    if (st.layerName === 'arboles') {
                        renderInfo([{ tipo: 'arbol', feature: f, source: 'arboles' }]);
                    } else if (st.layerName === 'subzonas') {
                        renderInfo([{ tipo: 'subzona', feature: f, source: 'subzonas' }]);
                    }
                }
            });
        });
        document.getElementById('attr-panel-wrap').querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (st.sortCol === col) st.sortDir = -st.sortDir;
                else { st.sortCol = col; st.sortDir = 1; }
                renderPanelTable();
            });
        });
    }

    function exportPanelCSV(st) {
        const filtered = filteredFor(st);
        const esc = v => {
            if (v === null || v === undefined) return '';
            const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
            if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
            return s;
        };
        const lines = [st.cols.map(esc).join(',')];
        for (const f of filtered) {
            const props = getPropsForPanel(f);
            lines.push(st.cols.map(c => esc(props[c])).join(','));
        }
        const csv = '\uFEFF' + lines.join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = st.layerLabel.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // =====================================================================
    // AUTOCOMPLETADO DE BUSQUEDA
    // =====================================================================
    let searchIndex = [];
    let idxText = [];
    function rebuildIndex() {
        idxText = searchIndex.map((item, i) => ({ item, i, lc: (item.text || '').toLowerCase() }));
        console.log('[visor] search_index:', searchIndex.length);
    }
    fetch('./data/search_index.json?v=3')
        .then(r => r.ok ? r.json() : [])
        .then(d => { searchIndex = d; rebuildIndex(); })
        .catch(e => console.error('[visor] search_index error:', e));

        function setupAutocomplete() {
        const input = document.getElementById('search-input');
        const list = document.getElementById('autocomplete');
        if (!input || !list) return;

        let activeIndex = -1;

        function renderMatches(q) {
            if (!q || q.length < 1 || idxText.length === 0) {
                list.innerHTML = '';
                list.style.display = 'none';
                activeIndex = -1;
                return;
            }
            const matches = idxText
                .filter(x => x.lc.includes(q))
                .slice(0, 20)
                .map(x => x.item);

            if (matches.length === 0) {
                list.innerHTML = '<div class="p-2 text-muted small">Sin resultados coincidentes</div>';
                list.style.display = 'block';
                activeIndex = -1;
                return;
            }

            list.innerHTML = matches.map((m, i) => {
                const extra = m.filter ? ` data-filter='${escapeHtml(JSON.stringify(m.filter))}'` : '';
                const icon = m.capa === 'subzonas' ? '📍' : '🌳';
                return `<div class="autocomplete-item ${i === activeIndex ? 'active' : ''}" data-idx="${i}" data-capa="${m.capa}" data-gid="${escapeHtml(m.gid)}"${extra}>
                    <span>${icon} <strong>${escapeHtml(m.text)}</strong></span>
                    <small class="text-muted d-block" style="font-size:0.75rem;">${escapeHtml(m.label || m.capa)}</small>
                </div>`;
            }).join('');

            list.style.display = 'block';

            list.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const filter = el.dataset.filter ? JSON.parse(el.dataset.filter) : null;
                    selectItem(el.dataset.capa, el.dataset.gid, filter);
                });
            });
        }

        input.addEventListener('input', () => {
            const q = input.value.toLowerCase().trim();
            renderMatches(q);
        });

        input.addEventListener('focus', () => {
            const q = input.value.toLowerCase().trim();
            if (q.length >= 1) renderMatches(q);
        });

        input.addEventListener('keydown', (e) => {
            const items = list.querySelectorAll('.autocomplete-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (items.length > 0) {
                    activeIndex = (activeIndex + 1) % items.length;
                    items.forEach((it, idx) => it.classList.toggle('active', idx === activeIndex));
                    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (items.length > 0) {
                    activeIndex = (activeIndex - 1 + items.length) % items.length;
                    items.forEach((it, idx) => it.classList.toggle('active', idx === activeIndex));
                    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const target = activeIndex >= 0 && items[activeIndex] ? items[activeIndex] : items[0];
                if (target) {
                    const filter = target.dataset.filter ? JSON.parse(target.dataset.filter) : null;
                    selectItem(target.dataset.capa, target.dataset.gid, filter);
                }
            } else if (e.key === 'Escape') {
                list.innerHTML = '';
                list.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !list.contains(e.target)) {
                list.style.display = 'none';
            }
        });
    }
    setupAutocomplete();

    function selectItem(capa, gid, filter) {
        const o = overlays[capa];
        if (!o) { console.warn('overlay', capa, 'no cargada'); return; }
        if (!o.layer.getVisible()) o.layer.setVisible(true);

        const list = document.getElementById('autocomplete');
        if (list) list.style.display = 'none';

        // Caso 1: filtro (arboles por especie / seccion / inventario)
        if (filter && typeof o.features[0]?.get === 'function') {
            const matches = o.features.filter(f => {
                for (const [k, v] of Object.entries(filter)) {
                    if (String(f.get(k) || '') !== String(v)) return false;
                }
                return true;
            });
            if (matches.length === 0) return;
            const input = document.getElementById('search-input');
            const sample = matches[0].getProperties();
            if (matches.length === 1) {
                const ext = matches[0].getGeometry().getExtent();
                map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 19, duration: 800 });
                input.value = sample.inventario ? `Inv ${sample.inventario} (${sample.especie || '?'})` : (sample.especie || '');
                showTreeInfo(matches[0]);
                highlightFeature(matches[0], capa, sample.inventario);
            } else {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const f of matches) {
                    const e = f.getGeometry().getExtent();
                    if (e[0] < minX) minX = e[0];
                    if (e[1] < minY) minY = e[1];
                    if (e[2] > maxX) maxX = e[2];
                    if (e[3] > maxY) maxY = e[3];
                }
                map.getView().fit([minX, minY, maxX, maxY], { padding: [60, 60, 60, 60], maxZoom: 18, duration: 800 });
                const tipo = Object.keys(filter)[0];
                input.value = `${matches.length.toLocaleString()} ${tipo === 'especie' ? sample.especie : tipo === 'seccion_bosque' ? 'árboles en ' + sample.seccion_bosque : 'árboles'}`;
                openBottomPanel('arboles');
                const val = sample[tipo] || '';
                if (val) {
                    bottomPanelState.filter = val;
                    const filterInput = document.getElementById('attr-panel-filter');
                    if (filterInput) filterInput.value = val;
                    bottomPanelState.page = 0;
                    renderPanelTable();
                }
            }
            return;
        }

        // Caso 2: subzona (gid = subzona)
        const key = String(gid).trim().toLowerCase();
        const feat = o.features.find(f => {
            const sz = String(f.get('subzona') || '').trim().toLowerCase();
            const id = String(f.get('gid') || f.get('id') || '').trim().toLowerCase();
            const nm = String(f.get('nombre') || '').trim().toLowerCase();
            return sz === key || id === key || nm === key || (key.length > 2 && nm.includes(key));
        });
        if (feat) {
            const ext = feat.getGeometry().getExtent();
            map.getView().fit(ext, { padding: [60, 60, 60, 60], maxZoom: 17, duration: 800 });
            const input = document.getElementById('search-input');
            input.value = (feat.get('subzona') || '') + ' ' + (feat.get('nombre') || '');
            showSubzonaInfo(feat);
            highlightFeature(feat, capa, key);
        } else {
            console.warn(`[visor] feature ${capa}/${gid} no encontrado`);
        }
    }

    // =====================================================================
    // CLICK-TO-IDENTIFY (siempre encuentra el feature mas cercano)
    // =====================================================================
    map.on('click', evt => {
        const visibleOverlayLayers = Object.values(overlays)
            .filter(o => o && o.layer.getVisible())
            .map(o => o.layer);

        // 1) Intento directo: features en el pixel + tolerancia 12px
        let features = [];
        if (visibleOverlayLayers.length > 0) {
            features = map.getFeaturesAtPixel(evt.pixel, {
                hitTolerance: 12,
                layerFilter: (layer) => visibleOverlayLayers.includes(layer)
            });
        }

        // 2) Si no hay hit directo, buscar el feature mas cercano (cualquier distancia)
        if (features.length === 0) {
            const coord = evt.coordinate;
            const closest = [];
            for (const o of Object.values(overlays)) {
                if (!o || !o.layer.getVisible()) continue;
                const src = o.layer.getSource();
                if (!src) continue;
                const layerName = o.layer.get('name');
                let candidates = [];
                if (src instanceof ol.source.Cluster) {
                    candidates = src.getFeatures();
                } else if (src.getFeatures) {
                    candidates = src.getFeatures();
                }
                let best = null, bestDist = Infinity;
                for (const f of candidates) {
                    let geom, inner;
                    if (f.get('features')) {
                        geom = f.getGeometry();
                        inner = f.get('features');
                    } else {
                        geom = f.getGeometry();
                        inner = [f];
                    }
                    if (!geom) continue;
                    const d = pointToFeatureDistance(coord, geom);
                    if (d < bestDist) { bestDist = d; best = { feature: f, inner, geom, layerName }; }
                }
                if (best) closest.push(best);
            }
            closest.sort((a, b) => pointToFeatureDistance(evt.coordinate, a.geom) - pointToFeatureDistance(evt.coordinate, b.geom));
            for (const c of closest.slice(0, 3)) {
                if (c.layerName === 'arboles') {
                    features.push({
                        get: (k) => k === 'features' ? c.inner : null,
                        getGeometry: () => c.geom
                    });
                } else {
                    features.push(c.feature);
                }
            }
        }

        if (features.length === 0) {
            // No se encontro nada cerca: mostrar coordenadas
            const panel = document.getElementById('info-panel');
            const content = document.getElementById('info-content');
            const coord = evt.coordinate;
            const lon = (coord[0] / 20037508.34 * 180).toFixed(5);
            const lat = (180 / Math.PI * (2 * Math.atan(Math.exp(coord[1] / 6378137)) - Math.PI / 2)).toFixed(5);
            panel.removeAttribute('hidden');
            panel.style.display = 'block';
            content.innerHTML = `<div class="alert alert-secondary p-2 mb-0">
                <small><strong>Click en</strong> ${lon}, ${lat}<br>
                No hay features cercanos. Haz zoom para ver más detalle.</small>
            </div>`;
            return;
        }

        // 3) Construir lista de hits: subzonas + cada arbol dentro del cluster
        //    Ya no hacemos zoom en multi-clusters: el usuario hace zoom manual con los controles
        const hits = [];
        for (const f of features) {
            const inner = f.get('features');
            if (Array.isArray(inner)) {
                // Es un cluster (real o fake): agregar CADA arbol interno
                inner.forEach(sf => hits.push({ tipo: 'arbol', feature: sf, source: 'arboles' }));
            } else {
                // Es un feature regular (subzona u otro polygon)
                hits.push({ tipo: 'subzona', feature: f, source: 'subzonas' });
            }
        }

        if (hits.length === 0) {
            closeInfo();
            return;
        }
        renderInfo(hits);
        // Sincronizar con la tabla del panel inferior si esta abierta
        syncSelectionWithPanel(hits);
    });

    // Encuentra el feature del click en la lista filtrada del bottom panel,
    // lo selecciona (fila amarilla) y hace highlight en el mapa.
    // Si el panel esta cerrado, lo abre automaticamente.
    // Si el feature esta en otra pagina, navega a esa pagina.
    function syncSelectionWithPanel(hits) {
        if (!hits || hits.length === 0) return;
        for (const h of hits) {
            const layerName = h.source || (h.tipo === 'arbol' ? 'arboles' : (h.tipo === 'subzona' || h.tipo === 'subzonas' ? 'subzonas' : null));
            if (!layerName) continue;

            // Si el panel esta cerrado o es de otra capa, abrirlo/cambiarlo
            if (!bottomPanelState.open || bottomPanelState.layerName !== layerName) {
                if (CFG.OVERLAY_LAYERS[layerName] || overlays[layerName]) {
                    openBottomPanel(layerName);
                } else {
                    continue;
                }
            }

            const f = h.feature;
            if (!f) continue;

            const filtered = filteredFor(bottomPanelState);
            let targetIdx = -1;

            // 1. Coincidencia por referencia de objeto exacto
            for (let i = 0; i < filtered.length; i++) {
                if (filtered[i] === f) {
                    targetIdx = i;
                    break;
                }
            }

            // 2. Coincidencia por ID (getId())
            if (targetIdx === -1) {
                const targetFid = f.getId ? f.getId() : null;
                if (targetFid !== null && targetFid !== undefined && targetFid !== '') {
                    for (let i = 0; i < filtered.length; i++) {
                        if (filtered[i].getId && String(filtered[i].getId()) === String(targetFid)) {
                            targetIdx = i;
                            break;
                        }
                    }
                }
            }

            // 3. Coincidencia por clave de propiedad (inventario, gid, id, subzona)
            if (targetIdx === -1) {
                const propsF = f.getProperties ? f.getProperties() : (f.properties || {});
                const keyF = propsF.inventario || propsF.gid || propsF.id || propsF.subzona;
                if (keyF != null && keyF !== '') {
                    for (let i = 0; i < filtered.length; i++) {
                        const p = filtered[i].getProperties ? filtered[i].getProperties() : (filtered[i].properties || {});
                        const keyI = p.inventario || p.gid || p.id || p.subzona;
                        if (keyI != null && String(keyI) === String(keyF)) {
                            targetIdx = i;
                            break;
                        }
                    }
                }
            }

            // 4. Coincidencia por geometria
            if (targetIdx === -1) {
                for (let i = 0; i < filtered.length; i++) {
                    if (featuresMatch(filtered[i], f)) {
                        targetIdx = i;
                        break;
                    }
                }
            }

            if (targetIdx === -1) continue;

            // Navegar a la pagina que contiene el elemento
            const PAGE = 100;
            const targetPage = Math.floor(targetIdx / PAGE);
            if (bottomPanelState.page !== targetPage) {
                bottomPanelState.page = targetPage;
                renderPanelTable();
            }

            // Seleccionar fila en tabla y hacer scroll centrado
            const wrap = document.getElementById('attr-panel-wrap');
            if (wrap) {
                document.querySelectorAll('.attr-table tr.attr-selected').forEach(r => r.classList.remove('attr-selected'));
                const tr = wrap.querySelector(`tr[data-fidx="${targetIdx}"]`);
                if (tr) {
                    tr.classList.add('attr-selected');
                    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            // Highlight amarillo en mapa
            highlightFeature(f, layerName, layerName);

            return; // sincronizado con la primera feature valida
        }
    }

    function featuresMatch(a, b) {
        // Comparar geometrias (mas confiable)
        try {
            const ga = a.getGeometry();
            const gb = b.getGeometry ? b.getGeometry() : (b.geometry ? new ol.format.GeoJSON().readGeometry(b.geometry) : null);
            if (ga && gb) {
                const ca = ga.getCoordinates();
                const cb = gb.getCoordinates();
                return JSON.stringify(ca) === JSON.stringify(cb);
            }
        } catch (e) { /* fallthrough */ }
        // Fallback: comparar por id
        const pa = a.getProperties ? a.getProperties() : (a.properties || {});
        const pb = b.getProperties ? b.getProperties() : (b.properties || {});
        for (const k of ['gid', 'id', 'subzona', 'inventario']) {
            if (pa[k] !== undefined && pa[k] === pb[k]) return true;
        }
        return false;
    }

    // Distancia minima entre un punto y una geometria (en coordenadas del mapa)
    function pointToFeatureDistance(coord, geom) {
        if (geom.getType && geom.getType() === 'Point') {
            const c = geom.getCoordinates();
            const dx = c[0] - coord[0], dy = c[1] - coord[1];
            return Math.sqrt(dx * dx + dy * dy);
        }
        // Para poligonos y lineas: extent al punto
        const ext = geom.getExtent();
        const x = Math.max(ext[0], Math.min(coord[0], ext[2]));
        const y = Math.max(ext[1], Math.min(coord[1], ext[3]));
        const dx = x - coord[0], dy = y - coord[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function renderInfo(hits) {
        const panel = document.getElementById('info-panel');
        const content = document.getElementById('info-content');
        panel.removeAttribute('hidden');
        panel.style.display = 'block';

        let html = '';
        hits.forEach((h, idx) => {
            let cardHtml = '';
            if (h.tipo === 'arbol') cardHtml = treeCard(h.feature);
            else if (h.tipo === 'subzona' || h.tipo === 'subzonas' || h.tipo === 'subzonas_v3') {
                cardHtml = subzonaCard(h.feature, h.tipo === 'subzonas_v3' ? 'Subzonas v3' : null);
            }
            html += `<div class="feature-info-card mb-2" data-hit-idx="${idx}" style="cursor:pointer;" title="Click para seleccionar en tabla de atributos">${cardHtml}</div>`;
        });
        if (!html) html = '<p class="text-muted small">No hay información para mostrar.</p>';
        content.innerHTML = html;

        content.querySelectorAll('.feature-info-card').forEach(card => {
            card.addEventListener('click', () => {
                const idx = parseInt(card.dataset.hitIdx);
                if (hits[idx]) {
                    syncSelectionWithPanel([hits[idx]]);
                }
            });
        });
    }

    function closeInfo() {
        const p = document.getElementById('info-panel');
        p.setAttribute('hidden', '');
        p.style.display = 'none';
    }

    function treeCard(f) {
        const p = f.getProperties();
        const title = `🌳 Árbol ${p.inventario || ''}`;
        const rows = [
            ['Especie', p.especie],
            ['Nombre común', p.nombre_comun],
            ['Diámetro tronco', p.diametro_tronco_cm],
            ['Altura', p.altura_m],
            ['Diámetro copa', p.diametro_copa_m],
            ['Sección', p.seccion_bosque],
            ['Subzona', p.subzona],
            ['Inventario', p.inventario],
        ];
        const rowsHtml = rows
            .filter(([k, v]) => v != null && v !== '')
            .map(([k, v]) => `<tr><td class="text-muted" style="width:40%"><small>${escape(k)}</small></td><td><small>${escape(v)}</small></td></tr>`)
            .join('');
        return `<div class="mb-2"><strong>${title}</strong>
            <table class="table table-sm table-bordered mb-0">${rowsHtml}</table></div>`;
    }

    function subzonaCard(f, label) {
        const p = f.getProperties();
        const lbl = label || 'Subzonas del Bosque';
        return `<div class="mb-2"><strong>🗺️ ${lbl}: ${escape(p.subzona || '')}</strong>
            <table class="table table-sm table-bordered mb-0">
                <tr><td class="text-muted"><small>Nombre</small></td><td><small>${escape(p.nombre || '')}</small></td></tr>
                <tr><td class="text-muted"><small>Área</small></td><td><small>${escape(p.area || '')}</small></td></tr>
                <tr><td class="text-muted"><small>Población arbórea</small></td><td><small>${escape(p.poblacion || '')}</small></td></tr>
                <tr><td class="text-muted"><small>Almacén carbono</small></td><td><small>${escape(p.almacen_carbono || '')}</small></td></tr>
                <tr><td class="text-muted"><small>Captura carbono</small></td><td><small>${escape(p.captura_carbono || '')}</small></td></tr>
                <tr><td class="text-muted"><small>Reducción escorrentía</small></td><td><small>${escape(p.reduccion_escorrentia || '')}</small></td></tr>
                <tr><td class="text-muted"><small>Valor servicios</small></td><td><small>${escape(p.valor_servicios_mxn || '')}</small></td></tr>
            </table></div>`;
    }

    function showTreeInfo(f) {
        renderInfo([{ tipo: 'arbol', feature: f, source: 'arboles' }]);
        syncSelectionWithPanel([{ tipo: 'arbol', feature: f, source: 'arboles' }]);
    }
    function showSubzonaInfo(f) {
        renderInfo([{ tipo: 'subzona', feature: f, source: 'subzonas' }]);
        syncSelectionWithPanel([{ tipo: 'subzona', feature: f, source: 'subzonas' }]);
    }

    document.getElementById('close-info').addEventListener('click', closeInfo);

    // =====================================================================
    // UTIL
    // =====================================================================
    function hexToRgba(hex, a) {
        const n = parseInt(hex.slice(1), 16);
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function escape(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Ajustar extent inicial al de las subzonas una vez que carguen
    // (Desactivado: el centro/zoom del config es la vista correcta para Chapultepec)
    // setTimeout(() => {
    //     if (overlays.subzonas && overlays.subzonas.features.length) {
    //         const view = map.getView();
    //         const curCenter = view.getCenter();
    //         const all_ext = overlays.subzonas.layer.getSource().getExtent();
    //         if (!ol.extent.containsCoordinate(all_ext, curCenter)) {
    //             view.fit(all_ext, { padding: [30, 30, 30, 30], duration: 0, maxZoom: 14 });
    //         }
    //     }
    // }, 2000);

    // Exponer para debug
    
    // =====================================================================
    // HERRAMIENTAS GIS: Dibujar en Mapa y Cargar KML / Shapefile / GeoJSON
    // =====================================================================
    const userDrawSource = new ol.source.Vector();
    const userDrawLayer = new ol.layer.Vector({
        source: userDrawSource,
        style: new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(82, 183, 136, 0.35)' }),
            stroke: new ol.style.Stroke({ color: '#1b4d3e', width: 3 }),
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({ color: '#2d6a4f' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            })
        }),
        zIndex: 250
    });
    map.addLayer(userDrawLayer);
    overlays['capa_usuario'] = { layer: userDrawLayer, info: { label: 'Mis Dibujos / Capas Cargadas', color: '#2d6a4f' }, features: [] };

    let drawInteraction = null;

    function saveUserDrawings() {
        try {
            const features = userDrawSource.getFeatures();
            if (features.length === 0) {
                localStorage.removeItem('visor_chapultepec_drawings');
                return;
            }
            const geojsonStr = new ol.format.GeoJSON().writeFeatures(features, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            localStorage.setItem('visor_chapultepec_drawings', geojsonStr);
            overlays['capa_usuario'].features = features;
        } catch (e) {
            console.error('[GIS] Error guardando dibujos:', e);
        }
    }

    function loadUserDrawings() {
        try {
            const saved = localStorage.getItem('visor_chapultepec_drawings');
            if (saved) {
                const features = new ol.format.GeoJSON().readFeatures(saved, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
                userDrawSource.addFeatures(features);
                overlays['capa_usuario'].features = features;
                console.log('[GIS] Cargados ' + features.length + ' elementos del localStorage.');
            }
        } catch (e) {
            console.error('[GIS] Error cargando localStorage:', e);
        }
    }
    loadUserDrawings();

    function setDrawMode(type) {
        if (drawInteraction) map.removeInteraction(drawInteraction);
        document.querySelectorAll('.btn-draw').forEach(b => b.classList.remove('active', 'bg-success', 'text-white'));
        if (!type) return;

        const btn = document.querySelector(`.btn-draw[data-type="${type}"]`);
        if (btn) btn.classList.add('active', 'bg-success', 'text-white');

        drawInteraction = new ol.interaction.Draw({
            source: userDrawSource,
            type: type
        });

        drawInteraction.on('drawend', e => {
            const feat = e.feature;
            feat.set('nombre', `Elemento ${type} #${userDrawSource.getFeatures().length + 1}`);
            feat.set('fecha', new Date().toLocaleString());
            setTimeout(() => {
                saveUserDrawings();
                setDrawMode(null);
                const ext = feat.getGeometry().getExtent();
                map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 18, duration: 600 });
            }, 50);
        });

        map.addInteraction(drawInteraction);
    }

    document.querySelectorAll('.btn-draw').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            if (btn.classList.contains('active')) setDrawMode(null);
            else setDrawMode(type);
        });
    });

    document.getElementById('btn-clear-draw')?.addEventListener('click', () => {
        if (userDrawSource.getFeatures().length === 0) return;
        if (confirm('¿Deseas borrar todos los elementos dibujados y cargados?')) {
            setDrawMode(null);
            userDrawSource.clear();
            saveUserDrawings();
            const status = document.getElementById('upload-status');
            if (status) status.textContent = 'Dibujos limpiados';
        }
    });

    document.getElementById('btn-export-draw')?.addEventListener('click', () => {
        const features = userDrawSource.getFeatures();
        if (features.length === 0) {
            alert('No hay elementos dibujados o cargados para exportar.');
            return;
        }
        const geojsonStr = new ol.format.GeoJSON().writeFeatures(features, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });
        const blob = new Blob([geojsonStr], { type: 'application/json;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `capa_usuario_chapultepec_${new Date().toISOString().slice(0,10)}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    // File Upload Handler (.kml, .geojson, .zip Shapefile)
    const fileInput = document.getElementById('gis-file-input');
    const uploadBtn = document.getElementById('btn-upload-file');
    const uploadStatus = document.getElementById('upload-status');

    uploadBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;

        const fname = file.name.toLowerCase();
        if (uploadStatus) uploadStatus.textContent = `Procesando ${file.name}...`;

        try {
            let features = [];
            if (fname.endsWith('.kml')) {
                const text = await file.text();
                features = new ol.format.KML({ extractStyles: true }).readFeatures(text, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
            } else if (fname.endsWith('.geojson') || fname.endsWith('.json')) {
                const text = await file.text();
                features = new ol.format.GeoJSON().readFeatures(text, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
            } else if (fname.endsWith('.zip')) {
                if (typeof shp !== 'undefined') {
                    const buffer = await file.arrayBuffer();
                    const geojson = await shp(buffer);
                    features = new ol.format.GeoJSON().readFeatures(geojson, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                } else {
                    throw new Error('Librería Shapefile (shp.js) no cargada.');
                }
            } else {
                throw new Error('Formato no soportado. Usa KML, GeoJSON o ZIP (Shapefile).');
            }

            if (features.length === 0) {
                throw new Error('No se encontraron elementos válidos en el archivo.');
            }

            userDrawSource.addFeatures(features);
            saveUserDrawings();

            const ext = userDrawSource.getExtent();
            if (ext && isFinite(ext[0])) {
                map.getView().fit(ext, { padding: [60, 60, 60, 60], maxZoom: 18, duration: 800 });
            }

            if (uploadStatus) uploadStatus.textContent = `✅ Cargar éxito: ${features.length} elementos`;
            fileInput.value = '';

        } catch (err) {
            console.error('[GIS] Error cargando archivo:', err);
            if (uploadStatus) uploadStatus.textContent = `❌ Error: ${err.message || err}`;
            alert(`Error al cargar ${file.name}: ${err.message || err}`);
            fileInput.value = '';
        }
    });


    
    // =====================================================================
    // LOCALIZACION EN TIEMPO REAL (GPS / Geolocalizacion)
    // =====================================================================
    const locationSource = new ol.source.Vector();
    const accuracyFeature = new ol.Feature();
    const positionFeature = new ol.Feature();

    positionFeature.setStyle(new ol.style.Style({
        image: new ol.style.Circle({
            radius: 9,
            fill: new ol.style.Fill({ color: '#1b4d3e' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
        })
    }));

    accuracyFeature.setStyle(new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(82, 183, 136, 0.25)' }),
        stroke: new ol.style.Stroke({ color: 'rgba(45, 106, 79, 0.6)', width: 2 })
    }));

    locationSource.addFeatures([accuracyFeature, positionFeature]);

    const locationLayer = new ol.layer.Vector({
        source: locationSource,
        zIndex: 300
    });
    map.addLayer(locationLayer);

    const geolocation = new ol.Geolocation({
        trackingOptions: {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        },
        projection: map.getView().getProjection()
    });

    let gpsActive = false;
    let followUser = true;
    let lastPosition = null;
    const SMOOTHING_FACTOR = 0.35; // Filtro suave de media móvil exponencial para eliminar rebotes GPS

    function smoothCoordinates(raw) {
        if (!lastPosition) {
            lastPosition = raw;
            return raw;
        }
        const smoothed = [
            lastPosition[0] + SMOOTHING_FACTOR * (raw[0] - lastPosition[0]),
            lastPosition[1] + SMOOTHING_FACTOR * (raw[1] - lastPosition[1])
        ];
        lastPosition = smoothed;
        return smoothed;
    }

    function toggleGPS() {
        gpsActive = !gpsActive;
        geolocation.setTracking(gpsActive);

        const gpsBtn = document.getElementById('gps-btn');
        const status = document.getElementById('upload-status');

        if (gpsActive) {
            if (gpsBtn) gpsBtn.classList.add('active');
            if (status) status.innerHTML = '🎯 <strong>Conectando GPS de Alta Precisión...</strong>';
        } else {
            if (gpsBtn) gpsBtn.classList.remove('active');
            positionFeature.setGeometry(null);
            accuracyFeature.setGeometry(null);
            lastPosition = null;
            if (status) status.textContent = 'GPS desactivado';
        }
    }

    geolocation.on('change:position', () => {
        const rawCoords = geolocation.getPosition();
        if (rawCoords) {
            const coords = smoothCoordinates(rawCoords);
            positionFeature.setGeometry(new ol.geom.Point(coords));

            const lonLat = ol.proj.toLonLat(coords);
            const latStr = lonLat[1].toFixed(6);
            const lonStr = lonLat[0].toFixed(6);
            const accuracy = (geolocation.getAccuracy() || 0).toFixed(1);

            if (followUser) {
                const targetZoom = accuracy < 15 ? 18.5 : 17;
                map.getView().animate({
                    center: coords,
                    zoom: Math.max(map.getView().getZoom(), targetZoom),
                    duration: 600
                });
            }

            const status = document.getElementById('upload-status');
            if (status) {
                status.innerHTML = `🎯 <strong>GPS Máxima Precisión (±${accuracy}m)</strong><br><small style="font-family:monospace; color:#1b4d3e;">Lat: ${latStr}° | Lon: ${lonStr}°</small>`;
            }
        }
    });

    geolocation.on('change:accuracyGeometry', () => {
        accuracyFeature.setGeometry(geolocation.getAccuracyGeometry());
    });

    geolocation.on('error', (error) => {
        console.error('[GPS] Error de geolocalización:', error);
        alert(`Error al obtener ubicación GPS: ${error.message || 'Sin permiso o señal GPS.'}`);
        gpsActive = true;
        toggleGPS();
    });

    // Agregar botón flotante de GPS sobre el mapa
    const gpsControlDiv = document.createElement('div');
    gpsControlDiv.className = 'ol-control-gps ol-unselectable ol-control';
    gpsControlDiv.innerHTML = `<button id="gps-btn" title="Mi ubicación GPS en tiempo real">🎯</button>`;
    document.getElementById('map').appendChild(gpsControlDiv);

    document.getElementById('gps-btn')?.addEventListener('click', toggleGPS);


    document.getElementById('btn-gps-panel')?.addEventListener('click', toggleGPS);

    window.__visor = { map, baseLayers, overlays, toggleBase, setAllBases, openBottomPanel };
})();


/* ==========================================================================
   MODULO REPRODUCTOR DE VIDEO Y TRAYECTORIA GPS DE DRON EN TIEMPO REAL
   ========================================================================== */

(function initFlightVideoModule() {

    function getMap() {
        if (window.__map && typeof window.__map.addLayer === 'function') return window.__map;
        if (window.__visor && window.__visor.map && typeof window.__visor.map.addLayer === 'function') return window.__visor.map;
        return null;
    }
    
    let flightTelemetry = null;
    let flightVectorSource = null;
    let flightVectorLayer = null;
    let droneMarkerFeature = null;
    let lineFeature = null;

    // SVG de icono de Dron profesional en verde neón con rotación dinámica
    function createDroneStyle(headingDeg, altMeters) {
        const rad = (headingDeg || 0) * Math.PI / 180;
        return new ol.style.Style({
            image: new ol.style.Icon({
                src: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="18" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="2"/>
                        <!-- Aspas del Dron -->
                        <circle cx="8" cy="8" r="4" fill="#00ff88" stroke="#133c2e"/>
                        <circle cx="32" cy="8" r="4" fill="#00ff88" stroke="#133c2e"/>
                        <circle cx="8" cy="32" r="4" fill="#00ff88" stroke="#133c2e"/>
                        <circle cx="32" cy="32" r="4" fill="#00ff88" stroke="#133c2e"/>
                        <!-- Cuerpo central -->
                        <path d="M12 12 L28 28 M28 12 L12 28" stroke="#ffffff" stroke-width="2.5"/>
                        <polygon points="20,6 26,20 14,20" fill="#00ff88" stroke="#133c2e" stroke-width="1.5"/>
                    </svg>
                `),
                anchor: [0.5, 0.5],
                scale: 1.1,
                rotation: rad
            }),
            text: new ol.style.Text({
                text: '🛸 Dron (' + (altMeters ? altMeters.toFixed(1) + 'm' : '56m') + ')',
                font: 'bold 12px Arial, sans-serif',
                fill: new ol.style.Fill({ color: '#ffffff' }),
                stroke: new ol.style.Stroke({ color: '#133c2e', width: 3 }),
                offsetY: -26
            })
        });
    }

    // Inicializar capas vectoriales para el mapa de OpenLayers
    function ensureFlightLayers() {
        if (!flightVectorSource) {
            flightVectorSource = new ol.source.Vector();
            flightVectorLayer = new ol.layer.Vector({
                source: flightVectorSource,
                zIndex: 999,
                title: 'Trayectoria Vuelo Video GPS'
            });

            const m = getMap(); if (m) { m.addLayer(flightVectorLayer); }
        }
    }

    // Cargar datos de telemetría JSON y dibujar trayectoria
    async function loadFlightTelemetry() {
        try {
            ensureFlightLayers();
            const res = await fetch('data/flight_telemetry.json?v=' + Date.now());
            if (!res.ok) throw new Error('No se pudo cargar la telemetría predeterminada');
            flightTelemetry = await res.json();
            
            drawTrajectoryOnMap(flightTelemetry);
            console.log('✅ Telemetría de vuelo cargada:', flightTelemetry.total_points, 'puntos');
        } catch (err) {
            console.warn('Carga de telemetría:', err);
        }
    }

    // Dibujar la polilínea del vuelo en OpenLayers
    function drawTrajectoryOnMap(data) {
        if (!data || !data.telemetry || data.telemetry.length === 0) return;
        ensureFlightLayers();
        flightVectorSource.clear();

        const coords = data.telemetry.map(p => ol.proj.fromLonLat([p.lon, p.lat]));

        // Feature Línea de Vuelo
        lineFeature = new ol.Feature({
            geometry: new ol.geom.LineString(coords),
            name: 'Trayectoria Vuelo Video'
        });

        // Estilo Neon Verde Glowing
        lineFeature.setStyle([
            new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'rgba(16, 185, 129, 0.4)',
                    width: 9
                })
            }),
            new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: '#00ff88',
                    width: 4
                })
            })
        ]);

        flightVectorSource.addFeature(lineFeature);

        // Marcador Inicio
        const startPoint = new ol.Feature({
            geometry: new ol.geom.Point(coords[0])
        });
        startPoint.setStyle(new ol.style.Style({
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({ color: '#10b981' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            }),
            text: new ol.style.Text({
                text: '🛫 Inicio',
                font: 'bold 11px sans-serif',
                fill: new ol.style.Fill({ color: '#10b981' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
                offsetY: 16
            })
        }));
        flightVectorSource.addFeature(startPoint);

        // Marcador Fin
        const endPoint = new ol.Feature({
            geometry: new ol.geom.Point(coords[coords.length - 1])
        });
        endPoint.setStyle(new ol.style.Style({
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({ color: '#ef4444' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            }),
            text: new ol.style.Text({
                text: '🛬 Fin',
                font: 'bold 11px sans-serif',
                fill: new ol.style.Fill({ color: '#ef4444' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
                offsetY: 16
            })
        }));
        flightVectorSource.addFeature(endPoint);

        // Marcador Dron Móvil
        droneMarkerFeature = new ol.Feature({
            geometry: new ol.geom.Point(coords[0])
        });
        droneMarkerFeature.setStyle(createDroneStyle(data.telemetry[0].heading, data.telemetry[0].alt));
        flightVectorSource.addFeature(droneMarkerFeature);

        // Ajustar vista del mapa a la trayectoria completa
        const m = getMap(); if (m) {
            const extent = flightVectorSource.getExtent();
            m.getView().fit(extent, {
                padding: [60, 60, 60, 60],
                maxZoom: 19.5,
                duration: 1000
            });
        }
    }

    // Sincronizar posición del Dron según el tiempo actual del Video
    function syncDroneWithVideo(currentTime) {
        if (!flightTelemetry || !flightTelemetry.telemetry || !droneMarkerFeature) return;
        const pts = flightTelemetry.telemetry;

        // Búsqueda binaria rápida del punto más cercano al timestamp
        let low = 0, high = pts.length - 1;
        let idx = 0;

        while (low <= high) {
            let mid = (low + high) >> 1;
            if (pts[mid].t <= currentTime) {
                idx = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        const point = pts[idx];
        if (point) {
            const coords = ol.proj.fromLonLat([point.lon, point.lat]);
            droneMarkerFeature.getGeometry().setCoordinates(coords);
            droneMarkerFeature.setStyle(createDroneStyle(point.heading, point.alt));

            // Actualizar interfaz HUD
            const elTime = document.getElementById('hud-time');
            const elAlt = document.getElementById('hud-alt');
            const elSpeed = document.getElementById('hud-speed');
            const elCoords = document.getElementById('hud-coords');

            if (elTime) elTime.textContent = '⏱️ ' + formatSecs(currentTime) + ' / ' + formatSecs(flightTelemetry.duration || 0);
            if (elAlt) elAlt.textContent = '📏 Alt: ' + point.alt.toFixed(1) + 'm';
            if (elSpeed) elSpeed.textContent = '🧭 ' + Math.round(point.heading) + '°';
            if (elCoords) elCoords.textContent = '📍 Lat: ' + point.lat.toFixed(5) + ', Lon: ' + point.lon.toFixed(5);
        }
    }

    function formatSecs(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    // Hacer la ventana de video arrastrable (Drag & Drop)
    function makeWindowDraggable(modalEl, handleEl) {
        let posX = 0, posY = 0, mouseX = 0, mouseY = 0;
        if (!handleEl || !modalEl) return;

        handleEl.onmousedown = function(e) {
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            mouseX = e.clientX;
            mouseY = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        };

        function elementDrag(e) {
            e.preventDefault();
            posX = mouseX - e.clientX;
            posY = mouseY - e.clientY;
            mouseX = e.clientX;
            mouseY = e.clientY;
            modalEl.style.top = (modalEl.offsetTop - posY) + 'px';
            modalEl.style.left = (modalEl.offsetLeft - posX) + 'px';
            modalEl.style.bottom = 'auto';
            modalEl.style.right = 'auto';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // Configurar Eventos DOM
    document.addEventListener('DOMContentLoaded', function() {
        const btnVideo = document.getElementById('btn-flight-video');
        const videoInput = document.getElementById('video-file-input');
        const modal = document.getElementById('flight-video-modal');
        const header = document.getElementById('video-window-header');
        const videoPlayer = document.getElementById('flight-video-player');
        const btnClose = document.getElementById('btn-close-video');
        const btnMin = document.getElementById('btn-minimize-video');
        const btnCustomVideo = document.getElementById('btn-load-custom-video');
        const btnCenterDrone = document.getElementById('btn-center-drone-map');

        if (modal && header) {
            makeWindowDraggable(modal, header);
        }

        // Cargar telemetría al iniciar
        loadFlightTelemetry();

        // Botón principal "Video Vuelo GPS"
        if (btnVideo) {
            btnVideo.addEventListener('click', function() {
                if (modal) {
                    modal.style.display = 'flex';
                    modal.classList.remove('minimized');
                }
                if (!flightTelemetry) {
                    loadFlightTelemetry();
                }
                // Si el video no tiene src cargado, intentar cargar por defecto
                if (videoPlayer && (!videoPlayer.src || videoPlayer.src === '')) {
                    videoPlayer.src = 'data/video.mp4';
                }
            });
        }

        // Seleccionar archivo MP4 local
        if (btnCustomVideo && videoInput) {
            btnCustomVideo.addEventListener('click', () => videoInput.click());
        }

        if (videoInput && videoPlayer) {
            videoInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const objectUrl = URL.createObjectURL(file);
                    videoPlayer.src = objectUrl;
                    videoPlayer.play().catch(() => {});
                    console.log('🎥 Video cargado dinámicamente:', file.name);
                }
            });
        }

        // Minimizar / Restaurar Ventana
        if (btnMin && modal) {
            btnMin.addEventListener('click', function() {
                modal.classList.toggle('minimized');
            });
        }

        // Cerrar Ventana
        if (btnClose && modal) {
            btnClose.addEventListener('click', function() {
                modal.style.display = 'none';
                if (videoPlayer) videoPlayer.pause();
            });
        }

        // Centrar mapa en la posición actual del Dron
        if (btnCenterDrone) {
            btnCenterDrone.addEventListener('click', function() {
                if (droneMarkerFeature && window.map) {
                    const coord = droneMarkerFeature.getGeometry().getCoordinates();
                    m.getView().animate({
                        center: coord,
                        zoom: 18.5,
                        duration: 600
                    });
                }
            });
        }

        // Sincronización en tiempo real del reproductor de video con la marca en el mapa
        if (videoPlayer) {
            videoPlayer.addEventListener('timeupdate', function() {
                syncDroneWithVideo(videoPlayer.currentTime);
            });
            videoPlayer.addEventListener('seeked', function() {
                syncDroneWithVideo(videoPlayer.currentTime);
            });
        }

        // Clic en la línea de trayectoria en el mapa para saltar al segundo del video
        const m = getMap(); if (m) {
            if (m) m.on('singleclick', function(evt) {
                if (!flightTelemetry || !flightTelemetry.telemetry || !videoPlayer) return;
                const feature = m.forEachFeatureAtPixel(evt.pixel, f => f);
                if (feature === lineFeature) {
                    const clickCoord = ol.proj.toLonLat(evt.coordinate);
                    // Buscar punto de telemetría más cercano
                    let minDistance = Infinity;
                    let bestTime = 0;
                    flightTelemetry.telemetry.forEach(p => {
                        const d = Math.hypot(p.lon - clickCoord[0], p.lat - clickCoord[1]);
                        if (d < minDistance) {
                            minDistance = d;
                            bestTime = p.t;
                        }
                    });
                    videoPlayer.currentTime = bestTime;
                    if (modal) modal.style.display = 'flex';
                }
            });
        }
    });
})();
