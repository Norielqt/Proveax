import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCurrentSession, startSession, heartbeat, endSession, uploadScreenshot,
} from '../api/sessions';
import { getToken } from '../api/client';

const HEARTBEAT_MS        = 30_000; // server heartbeat every 30s
const TICK_MS             = 1_000;  // timer tick every 1s
const BLACK_CHECK_MS      = 30_000; // sample the share stream every 30s
const BLACK_TOLERANCE_MS  = 120_000; // auto-end after 2 min of continuous black

// Fire a keepalive heartbeat during tab unload so the final counters survive
// the page going away. We deliberately do NOT end the session here — a refresh
// or accidental close should not lose progress. The server's stale-session
// closer (2x idle-timeout) handles truly abandoned sessions as 'orphaned'.
function flushOnUnload(sessionId, activeSeconds, idleSeconds) {
  try {
    const base  = import.meta.env.VITE_API_URL || '';
    const token = getToken();
    if (!token || !sessionId) return;

    const headers = {
      'Content-Type':  'application/json',
      Accept:          'application/json',
      Authorization:   `Bearer ${token}`,
    };

    fetch(`${base}/api/work-sessions/${sessionId}/heartbeat`, {
      method: 'POST',
      keepalive: true,
      headers,
      body: JSON.stringify({
        active_seconds: Math.round(activeSeconds),
        idle_seconds:   Math.round(idleSeconds),
      }),
    }).catch(() => {});
  } catch {
    // best-effort; swallow
  }
}

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
  const [dayEnded, setDayEnded] = useState(false);
  const [shareResumeDeadline, setShareResumeDeadline] = useState(null);
  // Tick counter forces re-renders so UI can show live counters from refs.
  const [, setTick] = useState(0);

  // local cumulative counters — current session only (sent to server via heartbeat)
  const activeSecondsRef = useRef(0);
  const idleSecondsRef   = useRef(0);

  // sum of all ENDED sessions today (computed on bootstrap + updated on end)
  const pastSecondsRef   = useRef(0);

  // last activity timestamp (ms)
  const lastActivityRef = useRef(Date.now());

  // wall-clock anchor for drift-free accumulation (survives bg-tab throttling)
  const lastTickAtRef = useRef(Date.now());

  // capture infra
  const streamRef   = useRef(null);
  const videoRef    = useRef(null);
  const captureRef  = useRef(null); // interval id
  const firstCaptureRef = useRef(null); // timeout id for the first capture
  const blackCheckRef   = useRef(null); // interval id for stream-black watchdog
  const blackSinceRef   = useRef(null); // ms timestamp when stream first went black
  const tickRef     = useRef(null);
  const heartbeatRef= useRef(null);

  const cleanupCapture = () => {
    if (firstCaptureRef.current) { clearTimeout(firstCaptureRef.current); firstCaptureRef.current = null; }
    if (blackCheckRef.current)   { clearInterval(blackCheckRef.current); blackCheckRef.current = null; }
    blackSinceRef.current = null;
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
        setDayEnded(!!data.day_ended);

        // Restore current-session counters from the last heartbeat the server
        // received (covers browser crash / forced close scenarios).
        if (data.session && !data.session.ended_at) {
          activeSecondsRef.current = data.session.active_seconds ?? 0;
          idleSecondsRef.current   = data.session.idle_seconds   ?? 0;
          // past = today total minus what the live session already has
          pastSecondsRef.current   = Math.max(0,
            (data.today_active_seconds ?? 0) - (data.session.active_seconds ?? 0)
          );
        } else {
          // No live session — entire today total is in past sessions
          pastSecondsRef.current   = data.today_active_seconds ?? 0;
          activeSecondsRef.current = 0;
          idleSecondsRef.current   = 0;
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

  // ---------- auto-pause if share isn't resumed after a refresh ----------
  // When the page reloads while a screenshots-enabled session is running,
  // the captured stream is gone (browser security). Immediately auto-pause
  // so no untracked time is accumulated. The user can resume from the banner.
  useEffect(() => {
    if (!session) return;
    if (session.ended_at) return;
    if (!session.screenshots_enabled) return;
    if (streamRef.current) return; // share already attached — nothing to do

    setShareResumeDeadline(null);
    _endInternal('auto_paused').catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // ---------- timer + heartbeat loops ----------
  useEffect(() => {
    if (!session || session.ended_at) { cleanupLoops(); return; }

    const idleTimeoutMs = (settings?.idle_timeout_minutes ?? 5) * 60_000;

    // Accumulate by wall-clock delta (not tick count) so backgrounded tabs
    // — where setInterval is throttled to ≥1s and often to 1/min — still
    // record the true elapsed time. On each wake-up (throttled tick or
    // visibilitychange) we add (now - lastTickAt) to the correct bucket.
    const accumulate = () => {
      const now    = Date.now();
      const deltaS = Math.max(0, (now - lastTickAtRef.current) / 1000);
      lastTickAtRef.current = now;
      if (deltaS <= 0) return;

      const hidden    = typeof document !== 'undefined' && document.hidden;
      const idleByAct = (now - lastActivityRef.current) >= idleTimeoutMs;
      // Hidden tabs receive no mouse/keyboard events, so DON'T treat
      // inactivity-while-hidden as idle — only flip to idle if the user
      // was still interacting but has now paused for > idleTimeout.
      const idle = !hidden && idleByAct;

      setIsIdle(idle);
      if (idle) idleSecondsRef.current   += deltaS;
      else      activeSecondsRef.current += deltaS;
      setTick((t) => t + 1);
    };

    lastTickAtRef.current = Date.now();
    tickRef.current = setInterval(accumulate, TICK_MS);

    // When the tab becomes visible again, reconcile any missed time.
    const onVisibility = () => {
      accumulate();
      // Also force a heartbeat so admins see fresh numbers promptly.
      heartbeat(session.id, Math.round(activeSecondsRef.current), Math.round(idleSecondsRef.current))
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Fire a best-effort final flush when the tab is actually going away.
    // 'pagehide' is the most reliable signal (fires for BFCache + real close),
    // 'beforeunload' is a belt-and-suspenders backup for older browsers.
    const onPageHide = () => {
      accumulate();
      flushOnUnload(
        session.id,
        activeSecondsRef.current,
        idleSecondsRef.current,
      );
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);

    heartbeatRef.current = setInterval(async () => {
      accumulate(); // ensure latest delta is captured before sending
      try {
        await heartbeat(
          session.id,
          Math.round(activeSecondsRef.current),
          Math.round(idleSecondsRef.current),
        );
      } catch {
        // swallow — network blips are fine, next tick will retry
      }
    }, HEARTBEAT_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      cleanupLoops();
    };
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
      // Do NOT reset pastSecondsRef — it carries today's accumulated total
      activeSecondsRef.current   = 0;
      idleSecondsRef.current     = 0;
      lastActivityRef.current    = Date.now();

      if (stream) attachStream(stream, data.session.id);

      return data.session;
    } catch (e) {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const errors = e.response?.data?.errors;
      const msg = (errors && Object.values(errors)[0]?.[0])
        || e.response?.data?.message
        || e.message
        || 'Could not start session.';
      setError(msg);
      throw e;
    } finally {
      setStarting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // Attach a captured screen-share stream to the local capture pipeline.
  // Used by both start() (fresh session) and resumeShare() (after a refresh).
  const attachStream = (stream, sessionId) => {
    streamRef.current = stream;

    stream.getVideoTracks()[0].addEventListener('ended', () => {
      // User stopped sharing via the browser's built-in "Stop sharing" button.
      // Treat as auto-pause so they can resume without losing their session.
      _endInternal('auto_paused').catch(() => {});
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.play().catch(() => {});
    videoRef.current = video;

    const intervalMs = (settings?.screenshot_interval_minutes ?? 10) * 60_000;

    firstCaptureRef.current = setTimeout(() => captureScreenshot(sessionId), 15_000);
    captureRef.current      = setInterval(() => captureScreenshot(sessionId), intervalMs);

    blackCheckRef.current = setInterval(() => {
      const black = isStreamBlack();
      if (black === null) return;
      if (black) {
        if (!blackSinceRef.current) blackSinceRef.current = Date.now();
        if (Date.now() - blackSinceRef.current >= BLACK_TOLERANCE_MS) {
          _endInternal('stream_black').catch(() => {});
        }
      } else {
        blackSinceRef.current = null;
      }
    }, BLACK_CHECK_MS);

    setShareResumeDeadline(null); // resume succeeded — cancel the grace timer
    setTick((t) => t + 1); // refresh consumers (needsShareResume flips false)
  };

  // Re-prompt the user for screen share after a page refresh while a session
  // with screenshots_enabled is still active server-side. Requires a user
  // gesture (button click).
  const resumeShare = useCallback(async () => {
    if (!session || session.ended_at) return;
    if (!session.screenshots_enabled) return;
    if (streamRef.current) return; // already attached

    setError(null);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Your browser does not support screen sharing.');
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 2 },
        audio: false,
      });
      attachStream(stream, session.id);
    } catch (e) {
      const msg = e?.message || 'Could not resume screen share.';
      setError(msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, settings]);

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
      // Update session state directly so the count is always authoritative
      setSession((prev) => {
        if (!prev) return prev;
        return { ...prev, screenshots_count: (prev.screenshots_count ?? 0) + 1 };
      });
    } catch {
      // swallow — we don't want a failed upload to kill the session
    }
  };

  // Returns true when the share stream is effectively black, false when it
  // has content, or null when the stream is not yet decodable.
  const isStreamBlack = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    try {
      const canvas = document.createElement('canvas');
      const SAMPLE = 32;
      canvas.width = SAMPLE; canvas.height = SAMPLE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, SAMPLE, SAMPLE);
      const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += data[i] + data[i + 1] + data[i + 2];
      }
      const avg = sum / (data.length / 4) / 3; // 0..255
      return avg < 6; // essentially black
    } catch {
      // Cross-origin or drawing error — assume not-black to avoid false ends.
      return false;
    }
  };

  // ---------- end ----------
  const _endInternal = async (reason) => {
    const current = session;
    if (!current || current.ended_at) return;

    setEnding(true);
    cleanupLoops();
    cleanupCapture();

    try {
      const data = await endSession(current.id, {
        activeSeconds: Math.round(activeSecondsRef.current),
        idleSeconds:   Math.round(idleSecondsRef.current),
        reason,
      });
      // Move this session's active time into the past-sessions bucket so the
      // daily total stays intact when the user views the idle screen or
      // starts a new session.
      pastSecondsRef.current  += Math.round(activeSecondsRef.current);
      activeSecondsRef.current = 0;
      idleSecondsRef.current   = 0;
      setSession(data.session);
      if (reason === 'manual') setDayEnded(true);
      setTick((t) => t + 1); // force re-render so UI shows updated total
    } catch (e) {
      setError(e.response?.data?.message || 'Could not end session.');
    } finally {
      setEnding(false);
    }
  };

  const end   = useCallback(() => _endInternal('manual'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session]);

  const pause = useCallback(() => _endInternal('paused'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session]);

  // True when an active session expects screenshots but the local stream is
  // missing (typical after a page refresh — getDisplayMedia cannot be re-
  // acquired without a fresh user gesture).
  const needsShareResume = !!session
    && !session.ended_at
    && !!session.screenshots_enabled
    && !streamRef.current;

  return {
    session, settings, loading, starting, ending, error, isIdle, dayEnded,
    activeSeconds:     Math.round(activeSecondsRef.current),
    idleSeconds:       Math.round(idleSecondsRef.current),
    totalTodaySeconds: Math.round(pastSecondsRef.current + activeSecondsRef.current),
    needsShareResume,
    shareResumeDeadline,
    start, end, pause, resumeShare,
  };
}
