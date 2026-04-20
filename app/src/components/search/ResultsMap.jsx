import { useEffect, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_KEY;

// Use full URLs to avoid deprecated MapStyle enum warnings and internal SDK crashes
const _KEY             = import.meta.env.VITE_MAPTILER_KEY;
const STYLE_STREETS    = `https://api.maptiler.com/maps/streets-v2/style.json?key=${_KEY}`;
const STYLE_SATELLITE  = `https://api.maptiler.com/maps/satellite/style.json?key=${_KEY}`;

const SATELLITE_ZOOM   = 15; // zoom >= this → switch to satellite
const AUTO_SEARCH_ZOOM = 11; // zoom >= this → fire map-move search
const MARKER_ZOOM      = 13; // below this: GL clusters; at/above: DOM price pills

// Format a dollar value to a short label: 68000 → "$68k", 1200000 → "$1.2M"
function formatPrice(val) {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n) || n <= 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

// Build a custom DOM element for a marker.
// Wrapped in a transparent container so MapTiler's marker wrapper has
// no visible background/border (fixes the "black coat" artefact).
function makeMarkerEl(label, isPrice) {
  // Outer wrapper — must be non-zero size so MapTiler doesn't collapse it,
  // but fully transparent so its default styling is invisible.
  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:transparent;border:none;padding:0;margin:0;box-shadow:none;outline:none';

  const pill = document.createElement('div');
  if (isPrice) {
    pill.style.cssText = [
      'display:inline-block',
      'background:#fff',
      'color:#111827',
      'font-size:11px',
      'font-family:system-ui,sans-serif',
      'line-height:1',
      'padding:4px 8px',
      'border-radius:0',
      'white-space:nowrap',
      'box-shadow:none',
      'border:1px solid #d1d5db',
      'cursor:pointer',
      'user-select:none',
      'transition:background .15s,border-color .15s',
    ].join(';');
    pill.textContent = label;
    pill.addEventListener('mouseenter', () => { pill.style.background = '#f3f4f6'; pill.style.borderColor = '#9ca3af'; });
    pill.addEventListener('mouseleave', () => { pill.style.background = '#fff'; pill.style.borderColor = '#d1d5db'; });
  } else {
    // Fallback dot for properties without a price
    pill.style.cssText = [
      'width:10px',
      'height:10px',
      'background:#6b7280',
      'border-radius:50%',
      'border:2px solid #fff',
      'box-shadow:none',
      'cursor:pointer',
    ].join(';');
  }

  wrap.appendChild(pill);
  return wrap;
}

function toGeoJSON(props) {
  return {
    type: 'FeatureCollection',
    features: props
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => {
        const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
        if (isNaN(lat) || isNaN(lng)) return null;
        return { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} };
      })
      .filter(Boolean),
  };
}

export default function ResultsMap({ properties, onViewChange, manualKey = 0, panKey = 0, hoveredId = null }) {
  const containerRef       = useRef(null);
  const mapRef             = useRef(null);
  const markerMapRef       = useRef(new Map()); // uid → { marker, pillEl }
  const onViewRef          = useRef(onViewChange);
  const isSatellite        = useRef(false);
  const suppressMoveRef    = useRef(false);
  const prevManualKeyRef   = useRef(manualKey);
  const prevPanKeyRef      = useRef(panKey);
  const currentZoomRef     = useRef(4);
  const glReadyRef         = useRef(false);
  const propertiesRef      = useRef(properties);
  const prevAboveMarkerRef = useRef(false);
  const hoverMarkerRef     = useRef(null);   // pulse dot shown in cluster mode
  const prevHoveredIdRef   = useRef(null);

  useEffect(() => { onViewRef.current = onViewChange; }, [onViewChange]);

  // ── GL helpers ────────────────────────────────────────────────────────────
  function setGLVis(map, visible) {
    if (!glReadyRef.current) return;
    const v = visible ? 'visible' : 'none';
    ['clusters', 'cluster-count', 'unclustered-point'].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
    });
  }

  function addGLLayers(map) {
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
    if (!map.getLayer('unclustered-point')) {
      map.addLayer({
        id: 'unclustered-point', type: 'circle', source: 'properties',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#3b82f6',
          'circle-radius': 5,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
    }
    glReadyRef.current = true;
    if (currentZoomRef.current >= MARKER_ZOOM) setGLVis(map, false);
  }

  function setupGL(map) {
    if (!map.getSource('properties')) {
      map.addSource('properties', {
        type: 'geojson',
        data: toGeoJSON(propertiesRef.current),
        cluster: true,
        clusterMaxZoom: MARKER_ZOOM - 1,
        clusterRadius: 50,
      });
    }
    addGLLayers(map);
  }

  // ── DOM marker helper ─────────────────────────────────────────────────────
  function installDomMarkers(map, props, clearFirst) {
    if (clearFirst) {
      markerMapRef.current.forEach(({ marker }) => marker.remove());
      markerMapRef.current.clear();
    }
    props
      .filter((p) => p.lat != null && p.lng != null)
      .forEach((p) => {
        const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
        if (isNaN(lat) || isNaN(lng)) return;
        const uid = String(p.attom_id ?? `${lat.toFixed(5)},${lng.toFixed(5)}`);
        if (markerMapRef.current.has(uid)) return;
        const priceLabel = formatPrice(p.estimated_value);
        const popup = new maptilersdk.Popup({ offset: 14, maxWidth: '220px' }).setHTML(`
          <div style="font-size:13px;line-height:1.5">
            <div style="font-weight:600;color:#111827">${p.address}</div>
            <div style="color:#6b7280">${p.city}, ${p.state} ${p.zip}</div>
            ${priceLabel ? `<div style="margin-top:4px;font-weight:500">Est. ${priceLabel}</div>` : ''}
            <button
              onclick="window.location.href='/properties/${p.attom_id ?? p.id}'"
              style="margin-top:8px;color:#2563eb;background:none;border:none;cursor:pointer;padding:0;font-size:12px"
            >View details →</button>
          </div>
        `);
        const wrapEl = makeMarkerEl(priceLabel, !!priceLabel);
        const pillEl = wrapEl.firstChild;
        const marker = new maptilersdk.Marker({ element: wrapEl, anchor: 'center' })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);
        markerMapRef.current.set(uid, { marker, pillEl });
      });
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
        setupGL(map);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12, duration: 1500 });
            },
            () => {}
          );
        }
      });

      // Re-setup GL layers after satellite ↔ streets style swap
      map.on('styledata', () => {
        if (!map.isStyleLoaded()) return;
        glReadyRef.current = false;
        markerMapRef.current.forEach(({ marker }) => marker.remove());
        markerMapRef.current.clear();
        setupGL(map);
        if (currentZoomRef.current >= MARKER_ZOOM) {
          setGLVis(map, false);
          installDomMarkers(map, propertiesRef.current, false);
        } else {
          setGLVis(map, true);
        }
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
        currentZoomRef.current = z;

        // Satellite toggle only — keep on per-frame 'zoom' for smooth transition
        const wantSatellite = z >= SATELLITE_ZOOM;
        if (wantSatellite !== isSatellite.current) {
          isSatellite.current = wantSatellite;
          map.setStyle(wantSatellite ? STYLE_SATELLITE : STYLE_STREETS);
        }
      });

      // LOD switch on zoomend (fires once after gesture completes) — far more
      // reliable than per-frame 'zoom' which can miss the threshold crossing.
      map.on('zoomend', () => {
        const z = map.getZoom();
        const nowAbove = z >= MARKER_ZOOM;
        if (nowAbove === prevAboveMarkerRef.current) return;
        prevAboveMarkerRef.current = nowAbove;

        if (nowAbove) {
          setGLVis(map, false);
          installDomMarkers(map, propertiesRef.current, true);
        } else {
          markerMapRef.current.forEach(({ marker }) => marker.remove());
          markerMapRef.current.clear();
          setGLVis(map, true);
        }
      });

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

    const isManualSearch = manualKey !== prevManualKeyRef.current;
    const isPanReset     = panKey    !== prevPanKeyRef.current;
    prevManualKeyRef.current = manualKey;
    prevPanKeyRef.current    = panKey;

    const apply = () => {
      const clearFirst = isManualSearch || isPanReset;

      // Always update the GeoJSON source so clusters reflect new data
      if (map.getSource('properties')) {
        map.getSource('properties').setData(toGeoJSON(properties));
      }

      if (currentZoomRef.current >= MARKER_ZOOM) {
        setGLVis(map, false);
        installDomMarkers(map, properties, clearFirst);
      } else {
        if (clearFirst) {
          markerMapRef.current.forEach(({ marker }) => marker.remove());
          markerMapRef.current.clear();
        }
        setGLVis(map, true);
      }

      if (isManualSearch && properties.length > 0) {
        const first = properties.find((p) => p.lat != null && p.lng != null);
        if (first) {
          suppressMoveRef.current = true;
          map.flyTo({ center: [parseFloat(first.lng), parseFloat(first.lat)], zoom: 12, duration: 800 });
        }
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once('styledata', apply);
    }
  }, [properties, manualKey, panKey]);

  // ── Hover highlight ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const prev = prevHoveredIdRef.current;
    prevHoveredIdRef.current = hoveredId;

    // Un-highlight previous pill
    if (prev !== null) {
      const uid = String(prev);
      const entry = markerMapRef.current.get(uid);
      if (entry?.pillEl) {
        entry.pillEl.style.outline     = '';
        entry.pillEl.style.boxShadow   = 'none';
        entry.pillEl.style.borderColor = '#d1d5db';
        entry.pillEl.style.transform   = '';
        entry.pillEl.style.zIndex      = '';
      }
    }

    // Remove cluster-mode pulse dot
    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.remove();
      hoverMarkerRef.current = null;
    }

    if (hoveredId === null || !map) return;

    const uid = String(hoveredId);
    const entry = markerMapRef.current.get(uid);

    if (entry?.pillEl) {
      // DOM mode — highlight the pill
      entry.pillEl.style.outline     = '2px solid #f59e0b';
      entry.pillEl.style.boxShadow   = '0 0 0 3px rgba(245,158,11,.25)';
      entry.pillEl.style.borderColor = '#f59e0b';
      entry.pillEl.style.transform   = 'scale(1.15)';
      entry.pillEl.style.zIndex      = '9999';
    } else {
      // Cluster mode — find the property coords and drop a pulsing dot
      const prop = propertiesRef.current.find(
        (p) => String(p.attom_id ?? p.id) === uid
      );
      if (!prop || prop.lat == null || prop.lng == null) return;
      const lat = parseFloat(prop.lat), lng = parseFloat(prop.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      const dot = document.createElement('div');
      dot.style.cssText = [
        'width:20px', 'height:20px',
        'background:rgba(245,158,11,0.9)',
        'border-radius:50%',
        'border:3px solid #fff',
        'box-shadow:0 0 0 4px rgba(245,158,11,.4)',
        'animation:pulse-ring 1s ease-out infinite',
        'pointer-events:none',
      ].join(';');

      // Inject keyframes once
      if (!document.getElementById('pulse-ring-style')) {
        const style = document.createElement('style');
        style.id = 'pulse-ring-style';
        style.textContent = `@keyframes pulse-ring{0%{box-shadow:0 0 0 0 rgba(245,158,11,.6)}100%{box-shadow:0 0 0 12px rgba(245,158,11,0)}}`;
        document.head.appendChild(style);
      }

      const wrap = document.createElement('div');
      wrap.style.cssText = 'background:transparent;border:none;padding:0;margin:0;box-shadow:none';
      wrap.appendChild(dot);

      hoverMarkerRef.current = new maptilersdk.Marker({ element: wrap, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map);
    }
  }, [hoveredId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
