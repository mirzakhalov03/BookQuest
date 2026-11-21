import { useEffect, useRef } from 'react';

const DEG_PER_PX = 0.55;
const LEAN_PER_PX = 0.18;
const MAX_LEAN = 14;
const HOVER_SPIN = 12;
const HOVER_LEAN = 6;
const STIFFNESS = 140;
// Under critical (2√140 ≈ 23.7): settles with a soft wobble, like a real weight.
const DAMPING = 14;
// How far a flick carries: release velocity (deg/s) × this = extra degrees before snapping.
const FLICK = 0.2;
// Keep in sync with `--tome-d` / `--book-w` in tome.css.
const DEPTH_RATIO = 0.16;
// A press that moves less than this is a tap, not a drag.
const TAP_PX = 6;
// A tap's kick: deg/s into the spin (random side) and the lean.
const KNOCK_SPIN = 260;
const KNOCK_LEAN = -120;

interface Spring {
  x: number;
  v: number;
  to: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const nearestTurn = (deg: number) => Math.round(deg / 360) * 360;
// Soft limit: follows the finger, then resists, never stops dead.
const rubber = (raw: number, max: number) => max * Math.tanh(raw / max);
/** Book's width on the floor at a given yaw — cover and spine both cast. */
const footprint = (yaw: number) => Math.abs(Math.cos(rad(yaw))) + DEPTH_RATIO * Math.abs(Math.sin(rad(yaw)));

interface BookRigOptions {
  /** Runs after a tap has already knocked the book — for the effects around it. */
  onTap?: () => void;
}

/**
 * Drag-to-turn, flick-to-spin, tap-to-knock and a gentle look-at-cursor for
 * the hidden book. Writes CSS vars on the zone (`--spin`, `--lean`, `--glare`,
 * `--footprint`) from a rAF spring, so a frame never touches React state.
 */
export function useBookRig<Zone extends HTMLElement, Rig extends HTMLElement>(
  enabled: boolean,
  { onTap }: BookRigOptions = {}
) {
  const zoneRef = useRef<Zone>(null);
  const rigRef = useRef<Rig>(null);
  // Latest callback without re-binding every listener on each render.
  const onTapRef = useRef(onTap);
  useEffect(() => {
    onTapRef.current = onTap;
  });

  useEffect(() => {
    const zone = zoneRef.current;
    const rig = rigRef.current;
    if (!enabled || !zone || !rig) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canHover = !reduced && matchMedia('(hover: hover) and (pointer: fine)').matches;

    const spin: Spring = { x: 0, v: 0, to: 0 };
    const lean: Spring = { x: 0, v: 0, to: 0 };
    let tilt = 28;
    let drag: { id: number; x0: number; y0: number; spin0: number; lastX: number; lastT: number; moved: boolean } | null =
      null;
    let raf = 0;
    let last = 0;

    const paint = () => {
      zone.style.setProperty('--spin', `${spin.x.toFixed(2)}deg`);
      zone.style.setProperty('--lean', `${lean.x.toFixed(2)}deg`);
      zone.style.setProperty('--glare', Math.sin(rad(spin.x)).toFixed(3));
      zone.style.setProperty('--footprint', (footprint(tilt + spin.x) / footprint(tilt)).toFixed(3));
    };

    const integrate = (s: Spring, dt: number) => {
      s.v += (-STIFFNESS * (s.x - s.to) - DAMPING * s.v) * dt;
      s.x += s.v * dt;
    };
    const settled = (s: Spring) => Math.abs(s.x - s.to) < 0.02 && Math.abs(s.v) < 0.05;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      integrate(spin, dt);
      integrate(lean, dt);
      if (settled(spin) && settled(lean)) {
        // Fold whole turns back to zero so the numbers never grow.
        spin.x = spin.to = spin.to - nearestTurn(spin.to);
        lean.x = lean.to;
        spin.v = lean.v = 0;
        paint();
        raf = 0;
        return;
      }
      paint();
      raf = requestAnimationFrame(tick);
    };

    const run = () => {
      if (raf) return;
      tilt = parseFloat(getComputedStyle(zone).getPropertyValue('--book-tilt')) || tilt;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || drag) return;
      stop();
      rig.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, spin0: spin.x, lastX: spin.x, lastT: e.timeStamp, moved: false };
      spin.v = lean.v = 0;
    };

    const onDragMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < TAP_PX) return;
      drag.moved = true;
      spin.x = drag.spin0 + (e.clientX - drag.x0) * DEG_PER_PX;
      lean.x = rubber(-(e.clientY - drag.y0) * LEAN_PER_PX, MAX_LEAN);
      const dt = (e.timeStamp - drag.lastT) / 1000;
      if (dt > 0) {
        // Smoothed so one jittery sample doesn't decide the flick.
        spin.v = 0.7 * ((spin.x - drag.lastX) / dt) + 0.3 * spin.v;
        drag.lastX = spin.x;
        drag.lastT = e.timeStamp;
      }
      paint();
    };

    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const tapped = !drag.moved && e.type === 'pointerup';
      drag = null;
      // Land on the cover again — a hard flick takes it all the way round first.
      spin.to = nearestTurn(spin.x + (reduced ? 0 : spin.v * FLICK));
      lean.to = 0;
      if (tapped) {
        // Shaken like a wrapped gift: a wobble to either side.
        spin.v += (Math.random() < 0.5 ? -1 : 1) * KNOCK_SPIN;
        lean.v += KNOCK_LEAN;
        onTapRef.current?.();
      }
      run();
    };

    const onHover = (e: PointerEvent) => {
      if (drag || e.pointerType !== 'mouse') return;
      const r = zone.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      spin.to = nearestTurn(spin.x) + nx * HOVER_SPIN;
      lean.to = ny * HOVER_LEAN;
      run();
    };

    const onLeave = () => {
      if (drag) return;
      spin.to = nearestTurn(spin.x);
      lean.to = 0;
      run();
    };

    rig.addEventListener('pointerdown', onDown);
    rig.addEventListener('pointermove', onDragMove);
    rig.addEventListener('pointerup', onUp);
    rig.addEventListener('pointercancel', onUp);
    if (canHover) {
      zone.addEventListener('pointermove', onHover);
      zone.addEventListener('pointerleave', onLeave);
    }

    return () => {
      stop();
      // Hand back a book at rest, e.g. when the hidden book is revealed.
      for (const prop of ['--spin', '--lean', '--glare', '--footprint']) zone.style.removeProperty(prop);
      rig.removeEventListener('pointerdown', onDown);
      rig.removeEventListener('pointermove', onDragMove);
      rig.removeEventListener('pointerup', onUp);
      rig.removeEventListener('pointercancel', onUp);
      zone.removeEventListener('pointermove', onHover);
      zone.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);

  return { zoneRef, rigRef };
}
