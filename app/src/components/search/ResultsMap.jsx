import { useEffect, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_KEY;

// Use full URLs to avoid deprecated MapStyle enum warnings and internal SDK crashes
const _KEY             = import.meta.env.VITE_MAPTILER_KEY;
const STYLE_STREETS    = `https://api.maptiler.com/maps/streets-v2/style.json?key=${_KEY}`;
const STYLE_SATELLITE  = `https://api.maptiler.com/maps/satellite/style.json?key=${_KEY}`;

const SATELLITE_ZOOM   = 15;
const AUTO_SEARCH_ZOOM = 11;
const MARKER_ZOOM      = 13; // below: GL clusters; at/above: GL price pills

function formatPrice(val) {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n) || n <= 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function toGeoJSON(props) {
  return {
    type: 'FeatureCollection',
    features: props
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => {
        const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
        if (isNaN(lat) || isNaN(lng)) return null;
        const uid = String(p.attom_id ?? `${lat.toFixed(5)},${lng.toFixed(5)}`);
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            uid,
            price: formatPrice(p.last_sale_price) || '',
            street: p.street || p.address || '',
            city: p.city || '',
            state: p.state || '',
            zip: p.zip || '',
            sqft: p.square_feet ? Number(p.square_feet).toLocaleString() : '',
            proptype: p.property_type || '',
          },
        };
      })
      .filter(Boolean),
  };
}

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

export default function ResultsMap({ properties, onViewChange, manualKey = 0, panKey = 0, hoveredId = null, onSelect, flyTo = null }) {
  const containerRef     = useRef(null);
  const mapRef           = useRef(null);
  const onViewRef        = useRef(onViewChange);
  const onSelectRef      = useRef(onSelect);
  const propByUidRef     = useRef(new Map());
  const isSatellite      = useRef(false);
  const suppressMoveRef  = useRef(false);
  const prevManualKeyRef = useRef(manualKey);
  const prevPanKeyRef    = useRef(panKey);
  const propertiesRef    = useRef(properties);
  const prevHoveredIdRef = useRef(null);
  const prevFlyToRef     = useRef(null);
  const pendingFlyRef    = useRef(false); // true when a manual search fired but results haven't arrived yet

  useEffect(() => { onViewRef.current = onViewChange; }, [onViewChange]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // Global bridge so popup inline onclick can reach React
  useEffect(() => {
    window.__pvxSelect = (uid) => {
      const p = propByUidRef.current.get(uid);
      if (p) onSelectRef.current?.(p);
    };
    return () => { delete window.__pvxSelect; };
  }, []);

  // ── Build all GL sources + layers (called on load & after style swap) ────
  function setupLayers(map) {
    // Canvas-based pill background with rounded corners + gray border.
    if (!map.hasImage('pill-bg')) {
      try {
        const s = 20, r = 4;
        const cv = document.createElement('canvas');
        cv.width = s; cv.height = s;
        const cx = cv.getContext('2d');
        // Manual rounded rect (avoids roundRect() which isn't in older browsers)
        cx.beginPath();
        cx.moveTo(r + 1, 1);
        cx.lineTo(s - r - 1, 1);
        cx.arcTo(s - 1, 1, s - 1, r + 1, r);
        cx.lineTo(s - 1, s - r - 1);
        cx.arcTo(s - 1, s - 1, s - r - 1, s - 1, r);
        cx.lineTo(r + 1, s - 1);
        cx.arcTo(1, s - 1, 1, s - r - 1, r);
        cx.lineTo(1, r + 1);
        cx.arcTo(1, 1, r + 1, 1, r);
        cx.closePath();
        cx.fillStyle = '#ffffff';
        cx.fill();
        cx.strokeStyle = '#d1d5db';
        cx.lineWidth = 1;
        cx.stroke();
        const imgData = cx.getImageData(0, 0, s, s);
        map.addImage('pill-bg', { width: s, height: s, data: imgData.data }, {
          content: [r + 1, r + 1, s - r - 1, s - r - 1],
          stretchX: [[r + 1, s - r - 1]],
          stretchY: [[r + 1, s - r - 1]],
        });
      } catch (_) {
        // Fallback: plain white pixel — pills still work, just no border
        try {
          map.addImage('pill-bg', { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) });
        } catch (_2) { /* already exists */ }
      }
    }

    // Main clustered data source
    if (!map.getSource('properties')) {
      map.addSource('properties', {
        type: 'geojson',
        data: toGeoJSON(propertiesRef.current),
        cluster: true,
        clusterMaxZoom: MARKER_ZOOM - 1,
        clusterRadius: 50,
      });
    }

    // Highlight source (single feature for hover glow)
    if (!map.getSource('highlight')) {
      map.addSource('highlight', { type: 'geojson', data: EMPTY_FC });
    }

    // ── Cluster circles ──
    if (!map.getLayer('clusters')) {
      map.addLayer({
        id: 'clusters', type: 'circle', source: 'properties',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#3b82f6', 50, '#1d4ed8', 500, '#1e3a8a'],
          'circle-radius': ['step', ['get', 'point_count'], 18, 50, 24, 500, 32],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
    }

    // ── Cluster count labels ──
    if (!map.getLayer('cluster-count')) {
      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'properties',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#fff' },
      });
    }

    // ── Unclustered dots (low zoom, before price pills appear) ──
    if (!map.getLayer('unclustered-point')) {
      map.addLayer({
        id: 'unclustered-point', type: 'circle', source: 'properties',
        filter: ['!', ['has', 'point_count']],
        maxzoom: MARKER_ZOOM,
        paint: {
          'circle-color': '#3b82f6',
          'circle-radius': 5,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
    }

    // ── Small fallback dots for price-hidden points (high zoom) ──
    // These show where pills were hidden by collision detection
    if (!map.getLayer('price-dots')) {
      map.addLayer({
        id: 'price-dots', type: 'circle', source: 'properties',
        filter: ['!', ['has', 'point_count']],
        minzoom: MARKER_ZOOM,
        paint: {
          'circle-color': '#3b82f6',
          'circle-radius': 4,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
        },
      });
    }

    // ── GL price pills (high zoom) ──
    // Collision detection is ON so pills don't overlap. Hidden ones
    // still appear as small dots from the layer above.
    if (!map.getLayer('price-labels')) {
      map.addLayer({
        id: 'price-labels', type: 'symbol', source: 'properties',
        filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'price'], '']],
        minzoom: MARKER_ZOOM,
        layout: {
          'icon-image': 'pill-bg',
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [3, 8, 3, 8],
          'text-field': ['get', 'price'],
          'text-size': 11,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false,
          'icon-allow-overlap': false,
          'icon-padding': 2,
          'text-anchor': 'center',
          'symbol-z-order': 'source',
        },
        paint: {
          'text-color': '#111827',
        },
      });
    }

    // ── Hover highlight ring ──
    if (!map.getLayer('highlight-glow')) {
      map.addLayer({
        id: 'highlight-glow', type: 'circle', source: 'highlight',
        paint: {
          'circle-radius': 18,
          'circle-color': 'rgba(245,158,11,0.15)',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#f59e0b',
        },
      });
    }
  }

  // ── Init map once ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let mapCleanup = null;

    const timer = setTimeout(() => {
      if (cancelled || !containerRef.current) return;

      const inner = document.createElement('div');
      inner.style.cssText = 'width:100%;height:100%';
      containerRef.current.appendChild(inner);

      const map = new maptilersdk.Map({
        container: inner,
        style:     STYLE_STREETS,
        center:    [-98.5795, 39.8283],
        zoom:      4,
      });

      map.on('load', () => {
        setupLayers(map);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12, duration: 1500 }),
            () => {}
          );
        }
      });

      // Rebuild our custom layers after any style swap (satellite ↔ streets).
      // setStyle() destroys all custom sources/layers. We track swaps with a
      // flag and listen to 'style.load' which fires once after the new style
      // is fully parsed and ready to accept addSource/addLayer calls.
      let pendingStyleSwap = false;

      map.on('style.load', () => {
        if (!pendingStyleSwap) return;
        pendingStyleSwap = false;
        setupLayers(map);
      });

      map.on('moveend', () => {
        if (suppressMoveRef.current) { suppressMoveRef.current = false; return; }
        const zoom = map.getZoom();
        if (zoom < AUTO_SEARCH_ZOOM) return;

        const center = map.getCenter();
        const bounds = map.getBounds();
        const latHalf  = (bounds.getNorth() - bounds.getSouth()) / 2;
        const lngHalf  = (bounds.getEast()  - bounds.getWest())  / 2;
        const cosLat   = Math.cos((center.lat * Math.PI) / 180);
        const radiusMiles = Math.sqrt(
          Math.pow(latHalf * 69, 2) + Math.pow(lngHalf * 69 * cosLat, 2)
        ) * 1.2;

        onViewRef.current?.({
          lat:    center.lat,
          lng:    center.lng,
          radius: Math.min(Math.ceil(radiusMiles), 25),
        });
      });

      map.on('zoom', () => {
        const z = map.getZoom();
        const wantSatellite = z >= SATELLITE_ZOOM;
        if (wantSatellite !== isSatellite.current) {
          isSatellite.current = wantSatellite;
          pendingStyleSwap = true;
          map.setStyle(wantSatellite ? STYLE_SATELLITE : STYLE_STREETS);
        }
      });

      // Click cluster → zoom in to expand
      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties.cluster_id;
        map.getSource('properties').getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom + 1 });
        });
      });

      // Hover popup — single reusable instance so only one shows at a time
      const hoverPopup = new maptilersdk.Popup({
        offset: 14,
        maxWidth: '320px',
        closeButton: false,
        closeOnClick: false,
      });

      const showHoverPopup = (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const coords = feature.geometry.coordinates.slice();
        const fp = feature.properties;
        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }
        map.getCanvas().style.cursor = 'pointer';
        clearTimeout(hideTimer);
        hoverPopup
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;padding:4px 2px;min-width:260px">
              <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:2px">${fp.street}</div>
              <div style="font-size:12px;color:#6b7280;margin-bottom:12px">${fp.city}, ${fp.state} ${fp.zip}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
                <div style="text-align:center">
                  <div style="font-size:15px;font-weight:700;color:#111827">${fp.price || '—'}</div>
                  <div style="font-size:10px;color:#9ca3af;margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Last Sale Price</div>
                </div>
                <div style="text-align:center;border-left:1px solid #f3f4f6;border-right:1px solid #f3f4f6">
                  <div style="font-size:15px;font-weight:700;color:#111827">${fp.sqft || '—'}</div>
                  <div style="font-size:10px;color:#9ca3af;margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Sq Ft</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:13px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px">${fp.proptype || '—'}</div>
                  <div style="font-size:10px;color:#9ca3af;margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Type</div>
                </div>
              </div>
              <button onclick="window.__pvxSelect('${fp.uid}')" style="width:100%;padding:7px 0;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">View Details</button>
            </div>
          `)
          .addTo(map);

        // Keep popup alive while mouse is over the popup DOM element
        const popupEl = hoverPopup.getElement();
        if (popupEl) {
          popupEl.addEventListener('mouseenter', () => clearTimeout(hideTimer));
          popupEl.addEventListener('mouseleave', () => scheduleHide());
        }
      };

      let hideTimer;
      const scheduleHide = () => {
        hideTimer = setTimeout(() => {
          map.getCanvas().style.cursor = '';
          hoverPopup.remove();
        }, 120);
      };

      const hideHoverPopup = () => {
        scheduleHide();
      };

      ['price-labels', 'unclustered-point', 'price-dots'].forEach((layer) => {
        map.on('mouseenter', layer, showHoverPopup);
        map.on('mouseleave', layer, hideHoverPopup);
      });

      // Clusters still use click + cursor
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });

      mapRef.current = map;
      mapCleanup = () => {
        mapRef.current = null;
        try { map.remove(); } catch (_) {}
        if (inner.parentNode) inner.parentNode.removeChild(inner);
      };
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (mapCleanup) mapCleanup();
    };
  }, []);

  // ── Sync data whenever properties change ──────────────────────────────────
  useEffect(() => {
    propertiesRef.current = properties;
    const map = mapRef.current;
    if (!map) return;

    // Rebuild uid → property lookup
    propByUidRef.current.clear();
    properties.forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
      if (isNaN(lat) || isNaN(lng)) return;
      const uid = String(p.attom_id ?? `${lat.toFixed(5)},${lng.toFixed(5)}`);
      propByUidRef.current.set(uid, p);
    });

    const isManualSearch = manualKey !== prevManualKeyRef.current;
    prevManualKeyRef.current = manualKey;
    prevPanKeyRef.current    = panKey;

    // If a new manual search fired, mark the pending fly flag.
    // We don't fly yet because properties might still be empty.
    if (isManualSearch) pendingFlyRef.current = true;

    const apply = () => {
      // Just update GeoJSON — GL layers re-render automatically (no DOM churn)
      if (map.getSource('properties')) {
        map.getSource('properties').setData(toGeoJSON(properties));
      }

      if (pendingFlyRef.current && properties.length > 0) {
        pendingFlyRef.current = false;
        const first = properties.find((p) => p.lat != null && p.lng != null);
        if (first) {
          suppressMoveRef.current = true;
          map.flyTo({ center: [parseFloat(first.lng), parseFloat(first.lat)], zoom: 12, duration: 800 });
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('styledata', apply);
  }, [properties, manualKey, panKey]);

  // ── Fly to geocoded location when user picks a suggestion ────────────────
  useEffect(() => {
    if (!flyTo || flyTo === prevFlyToRef.current) return;
    prevFlyToRef.current = flyTo;
    const map = mapRef.current;
    if (!map) return;
    suppressMoveRef.current = true;
    if (flyTo.bbox && flyTo.bbox.length === 4) {
      const [west, south, east, north] = flyTo.bbox;
      map.fitBounds([[west, south], [east, north]], { padding: 60, duration: 900, maxZoom: 14 });
    } else if (flyTo.center) {
      map.flyTo({ center: flyTo.center, zoom: 12, duration: 900 });
    }
  }, [flyTo]);

  // ── Hover highlight (amber ring via GL source) ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    prevHoveredIdRef.current = hoveredId;

    if (!map || !map.getSource('highlight')) return;

    if (hoveredId === null) {
      map.getSource('highlight').setData(EMPTY_FC);
      return;
    }

    const uid = String(hoveredId);
    const prop = propertiesRef.current.find(
      (p) => String(p.attom_id ?? p.id) === uid
    );
    if (!prop || prop.lat == null || prop.lng == null) {
      map.getSource('highlight').setData(EMPTY_FC);
      return;
    }

    const lat = parseFloat(prop.lat), lng = parseFloat(prop.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    map.getSource('highlight').setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} }],
    });
  }, [hoveredId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
