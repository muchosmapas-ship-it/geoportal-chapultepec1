    const customAttribution = `&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors<hr style="margin:6px 0;border-color:rgba(0,0,0,0.15);"><strong style="color:#0d2c54;">Universidad Abierta y a Distancia de México</strong><br><small style="color:#475569;font-weight:600;">DIVISIÓN DE CIENCIAS SOCIALES Y ADMINISTRATIVAS</small><br><strong>Gestión Territorial</strong><br><br><span style="color:#334155;">Análisis integral del estado del arbolado en el Bosque de Chapultepec mediante drones para fortalecer la gestión territorial y la conservación de áreas verdes urbanas</span><br><br><strong style="color:#092240;">EDGAR LÓPEZ PÉREZ</strong> (<a href="mailto:jhonson2490@gmail.com">jhonson2490@gmail.com</a>)`;
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
            if (isDetail) {
                badge.className = 'badge bg-success w-100 p-2 mb-2 text-wrap';
                badge.innerHTML = `?? <strong>Detalle Activo (5 cm/px)</strong><br><small>Zoom ${zoom.toFixed(1)} - Copas y ramas individuales</small>`;
            } else {
                badge.className = 'badge bg-primary w-100 p-2 mb-2 text-wrap';
                badge.innerHTML = `?? <strong>Panor?mica Activa (50 cm/px)</strong><br><small>Zoom ${zoom.toFixed(1)} - Vista general</small>`;
            }
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
                            fill: new ol.style.Fill({ color: '#0d2c54' }),
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
            fill: new ol.style.Fill({ color: 'rgba(255, 215, 0, 0.35)' }),  // amarillo semi-transparente
            stroke: new ol.style.Stroke({ color: '#d97706', width: 4 }),
            image: new ol.style.Circle({
                radius: 10,
                fill: new ol.style.Fill({ color: 'rgba(255, 215, 0, 0.6)' }),
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
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="text-muted">Mapas base:</small>
                    <div>
                        <button class="btn btn-sm btn-link p-0 me-1" id="bases-all-on" title="Prender todas">ON</button>
                        <button class="btn btn-sm btn-link p-0" id="bases-all-off" title="Apagar todas">OFF</button>
                    </div>
                </div>
                ${Object.entries(CFG.BASE_LAYERS)
                    .filter(([n, i]) => !n.endsWith('_overview'))  // ocultar overviews (auto-switch)
                    .map(([n, i]) => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="base-${n}" ${userEnabledBases[n] ? 'checked' : ''}>
                        <label class="form-check-label" for="base-${n}" style="font-size:0.85rem;cursor:context-menu" data-layer-type="base" data-layer-name="${n}" title="Click derecho: ver tabla">${i.label}</label>
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
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="text-muted">Capas superpuestas:</small>
                    <div>
                        <button class="btn btn-sm btn-link p-0 me-1" id="ovs-all-on" title="Prender todas">ON</button>
                        <button class="btn btn-sm btn-link p-0" id="ovs-all-off" title="Apagar todas">OFF</button>
                    </div>
                </div>
                <div id="ortho-mode-badge" class="mb-2"></div>
                ${Object.entries(CFG.OVERLAY_LAYERS).map(([name, info]) => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="ov-${name}" ${overlays[name]?.layer.getVisible() ? 'checked' : ''}>
                        <label class="form-check-label" for="ov-${name}" style="font-size:0.85rem;cursor:context-menu" data-layer-type="overlay" data-layer-name="${name}" title="Click derecho: ver tabla de atributos">${info.label}</label>
                        ` + (name === 'arboles' ? `<div class="mt-2 p-2 bg-light rounded border" style="font-size:10px; line-height: 1.2;">
                            <div style="font-weight: bold; margin-bottom: 4px; color: #333;">Concentraci?n de ?rboles:</div>
                            <div class="d-flex align-items-center justify-content-between text-center">
                                <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2e7d32;border:1px solid #fff;"></span><br><span style="font-size:9px;color:#555;">1-20 (puntos)</span></div>
                                <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:rgba(255, 193, 7, 0.9);border:1px solid #fff;"></span><br><span style="font-size:9px;color:#555;">21-100</span></div>
                                <div><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:rgba(255, 152, 0, 0.9);border:1px solid #fff;"></span><br><span style="font-size:9px;color:#555;">101-500</span></div>
                                <div><span style="display:inline-block;width:15px;height:15px;border-radius:50%;background:rgba(244, 67, 54, 0.9);border:1px solid #fff;"></span><br><span style="font-size:9px;color:#555;">501-1.5k</span></div>
                                <div><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:rgba(183, 28, 28, 0.96);border:1px solid #fff;"></span><br><span style="font-size:9px;color:#555;">&gt;1.5k</span></div>
                            </div>
                        </div>` : '') + `
                    </div>`).join('')}
            `;
            ovPanel.querySelectorAll('input[id^=ov-]').forEach(c => {
                c.addEventListener('change', e => {
                    const name = c.id.replace('ov-', '');
                    const o = overlays[name];
                    if (o) o.layer.setVisible(e.target.checked);
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
        // Acerca de
        const acerca = document.getElementById('acerca-de');
        if (acerca) {
            acerca.innerHTML = `
                <p class="mb-1"><strong>Bosque de Chapultepec</strong></p>
                <p class="mb-1">Ortofoto UAV - Vuelo: 2026 ·</p>
                <p class="mb-0">SEDEMA/ INyDES / UnADM</p>
            `;
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
    let bottomPanelState = { open: false, height: 280, layerName: null, allFeatures: [], cols: [], filter: '', page: 0, sortCol: null, sortDir: 1, layerColor: '#0d2c54', layerLabel: '' };

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
        bottomPanelState.layerColor = info.color || '#0d2c54';
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

    function filteredFor(st) {
        return st.filter
            ? st.allFeatures.filter(f => JSON.stringify(getPropsForPanel(f)).toLowerCase().includes(st.filter.toLowerCase()))
            : st.allFeatures;
    }

    function getPropsForPanel(f) {
        return f.getProperties ? f.getProperties() : (f.properties || {});
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

        input.addEventListener('input', () => {
            const q = input.value.toLowerCase().trim();
            if (q.length < 2 || idxText.length === 0) { list.innerHTML = ''; return; }
            const matches = idxText
                .filter(x => x.lc.includes(q))
                .slice(0, 15)
                .map(x => x.item);
            list.innerHTML = matches.map((m, i) => {
                const extra = m.filter ? ` data-filter='${escape(JSON.stringify(m.filter))}'` : '';
                return `<div class="autocomplete-item" data-idx="${i}" data-capa="${m.capa}" data-gid="${escape(m.gid)}"${extra}>
                    <strong>${escape(m.text)}</strong> <small class="text-muted">${escape(m.label || m.capa)}</small>
                </div>`;
            }).join('');
            list.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', () => {
                    const filter = el.dataset.filter ? JSON.parse(el.dataset.filter) : null;
                    selectItem(el.dataset.capa, el.dataset.gid, filter);
                });
            });
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const first = list.querySelector('.autocomplete-item');
                if (first) {
                    e.preventDefault();
                    const filter = first.dataset.filter ? JSON.parse(first.dataset.filter) : null;
                    selectItem(first.dataset.capa, first.dataset.gid, filter);
                }
            }
        });
    }
    setupAutocomplete();

    function selectItem(capa, gid, filter) {
        const o = overlays[capa];
        if (!o) { console.warn('overlay', capa, 'no cargada'); return; }
        if (!o.layer.getVisible()) o.layer.setVisible(true);

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
            document.getElementById('autocomplete').innerHTML = '';
            return;
        }

        // Caso 2: subzona (gid = subzona)
        const key = String(gid);
        const feat = o.features.find(f =>
            String(f.get('gid') || '') === key
            || String(f.get('id') || '') === key
            || String(f.get('subzona') || '') === key
        );
        if (feat) {
            const ext = feat.getGeometry().getExtent();
            map.getView().fit(ext, { padding: [60, 60, 60, 60], maxZoom: 17, duration: 800 });
            const input = document.getElementById('search-input');
            input.value = (feat.get('subzona') || '') + ' ' + (feat.get('nombre') || '');
            document.getElementById('autocomplete').innerHTML = '';
            showSubzonaInfo(feat);
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
    window.__visor = { map, baseLayers, overlays, toggleBase, setAllBases };
})();
