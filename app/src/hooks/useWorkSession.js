import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCurrentSession, startSession, heartbeat, endSession, uploadScreenshot,
} from '../api/sessions';

const HEARTBEAT_MS  = 30_000; // server heartbeat every 30s
const TICK_MS       = 1_000;  // timer tick every 1s

/**
 * Custom hook for managing a work session.
 *
 * Responsibilities:
 *  - Start / end a session with the server
 *  - Track active vs idle seconds locally, push to server via heartbeat
 *  - Optional screen capture via getDisplayMedia + periodic JPEG snapshot
 *  - Auto-end on stream stop (user clicks "Stop sharing" in browser UI)
 */
export function useWorkSession() {
  const [session,  setSession]  = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending,   setEnding]   = useState(false);
  const [error,    setError]    = useState(null);
  const [isIdle,   setIsIdle]   = useState(false);
  // Tick counter forces re-renders so UI can show live counters from refs.
  const [, setTick] = useState(0);

  // local cumulative counters (cumulative since session start)
  const activeSecondsRef = useRef(0);
  const idleSecondsRef   = useRef(0);

  // last activity timestamp (ms)
  const lastActivityRef = useRef(Date.now());

  // capture infra
  const streamRef   = useRef(null);
  const videoRef    = useRef(null);
  const captureRef  = useRef(null); // interval id
  const tickRef     = useRef(null);
  const heartbeatRef= useRef(null);

  const cleanupCapture = () => {
    if (captureRef.current) { clearInterval(captureRef.current); captureRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
  };

  const cleanupLoops = () => {
    if (tickRef.current)      { clearInterval(tickRef.current); tickRef.current = null; }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
  };

  // ---------- bootstrap ----------
  useEffect(() => {
    (async () => {
      try {
        const data = await getCurrentSession();
        setSession(data.session);
        setSettings(data.settings);
        if (data.session) {
          // Resume counters from server values
          activeSecondsRef.current = data.session.active_seconds ?? 0;
          idleSecondsRef.current   = data.session.idle_seconds ?? 0;
          // NB: screen capture stream cannot be resumed after reload — user
          // would need to restart session. For v1 we leave that to the UI.
        }
      } catch (e) {
        setError(e.response?.data?.message || 'Could not load session.');
      } finally {
        setLoading(false);
      }
    })();

    return () => { cleanupLoops(); cleanupCapture(); };
  }, []);

  // ---------- activity listeners ----------
  useEffect(() => {
    const bump = () => { lastActivityRef.current = Date.now(); };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  // ---------- timer + heartbeat loops ----------
  useEffect(() => {
    if (!session || session.ended_at) { cleanupLoops(); return; }

    const idleTimeoutMs = (settings?.idle_timeout_minutes ?? 5) * 60_000;

    tickRef.current = setInterval(() => {
      const elapsedSinceActivity = Date.now() - lastActivityRef.current;
      const idle = elapsedSinceActivity >= idleTimeoutMs;
      setIsIdle(idle);
      setTick((t) => t + 1);
      if (idle) idleSecondsRef.current += 1;
      else      activeSecondsRef.current += 1;
    }, TICK_MS);

    heartbeatRef.current = setInterval(async () => {
      try {
        await heartbeat(session.id, activeSecondsRef.current, idleSecondsRef.current);
      } catch {
        // swallow — network blips are fine, next tick will retry
      }
    }, HEARTBEAT_MS);

    return cleanupLoops;
  }, [session, settings]);

  // ---------- start ----------
  const start = useCallback(async (withScreenshots) => {
    setStarting(true); setError(null);
    let stream = null;

    try {
      if (withScreenshots) {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error('Your browser does not support screen sharing.');
        }
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 2 },
          audio: false,
        });
      }

      const data = await startSession(!!withScreenshots);
      setSession(data.session);
      activeSecondsRef.current = 0;
      idleSecondsRef.current   = 0;
      lastActivityRef.current  = Date.now();

      if (stream) {
        streamRef.current = stream;

        // If user clicks browser's built-in "Stop sharing" button
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          _endInternal('share_stopped').catch(() => {});
        });

        // Play stream into off-screen video for canvas capture
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        videoRef.current = video;

        const intervalMs = (settings?.screenshot_interval_minutes ?? 10) * 60_000;

        // First capture after ~15s to confirm pipeline works, then on schedule
        const scheduleFirst = setTimeout(() => captureScreenshot(data.session.id), 15_000);

        captureRef.current = setInterval(() => captureScreenshot(data.session.id), intervalMs);

        // Cleanup: also cancel scheduled first capture if session ends early
        captureRef.current.__first = scheduleFirst;
      }

      return data.session;
    } catch (e) {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const msg = e.response?.data?.message || e.message || 'Could not start session.';
      setError(msg);
      throw e;
    } finally {
      setStarting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // ---------- screenshot capture ----------
  const captureScreenshot = async (sessionId) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement('canvas');
    // Downscale for storage efficiency — max width 1600
    const maxW = 1600;
    const scale = Math.min(1, maxW / w);
    canvas.width  = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.75));
    if (!blob) return;

    try {
      await uploadScreenshot(sessionId, blob, new Date().toISOString());
    } catch {
      // swallow — we don't want a failed upload to kill the session
    }
  };

  // ---------- end ----------
  const _endInternal = async (reason) => {
    const current = session;
    if (!current || current.ended_at) return;

    setEnding(true);
    cleanupLoops();
    if (captureRef.current?.__first) clearTimeout(captureRef.current.__first);
    cleanupCapture();

    try {
      const data = await endSession(current.id, {
        activeSeconds: activeSecondsRef.current,
        idleSeconds:   idleSecondsRef.current,
        reason,
      });
      setSession(data.session);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not end session.');
    } finally {
      setEnding(false);
    }
  };

  const end = useCallback(() => _endInternal('manual'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session]);

  return {
    session, settings, loading, starting, ending, error, isIdle,
    activeSeconds: activeSecondsRef.current,
    idleSeconds:   idleSecondsRef.current,
    start, end,
  };
}
