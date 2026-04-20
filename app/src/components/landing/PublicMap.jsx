import { useEffect, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_KEY;

const _KEY          = import.meta.env.VITE_MAPTILER_KEY;
const STYLE_STREETS = `https://api.maptiler.com/maps/streets-v2/style.json?key=${_KEY}`;

const DEMO_PINS = [
  { id: 1, lat: 25.7617, lng: -80.1918, label: 'Miami, FL' },
  { id: 2, lat: 29.7604, lng: -95.3698, label: 'Houston, TX' },
  { id: 3, lat: 33.7490, lng: -84.3880, label: 'Atlanta, GA' },
  { id: 4, lat: 40.7128, lng: -74.0060, label: 'New York, NY' },
  { id: 5, lat: 34.0522, lng: -118.2437, label: 'Los Angeles, CA' },
];

export default function PublicMap() {
  const containerRef = useRef(null);

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
        container:         inner,
        style:             STYLE_STREETS,
        center:            [-98.5795, 39.8283],
        zoom:              4,
        scrollZoom:        false,
        navigationControl: false,
      });

      DEMO_PINS.forEach((p) => {
        new maptilersdk.Marker({ color: '#2563eb' })
          .setLngLat([p.lng, p.lat])
          .setPopup(
            new maptilersdk.Popup({ offset: 25 }).setHTML(`
              <div style="font-size:13px;line-height:1.5">
                <div style="font-weight:600;color:#111827">${p.label}</div>
                <div style="color:#6b7280">Sign up to explore properties here.</div>
              </div>
            `)
          )
          .addTo(map);
      });

      mapCleanup = () => {
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

  return <div ref={containerRef} className="h-full w-full" />;
}
