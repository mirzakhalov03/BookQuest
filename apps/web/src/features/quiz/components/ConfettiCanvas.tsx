import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const COLOUR_TOKENS = ['--color-ember', '--color-amber', '--color-gold', '--color-gold-soft', '--color-paper'];
// A popper fires from a bottom corner every so often; the first volley is both corners at once.
const VOLLEY_EVERY_MS = 2600;
const PIECES_PER_POP = 70;
const GRAVITY = 0.16;
const DRAG = 0.985;

type Piece = {
  x: number; y: number; vx: number; vy: number;
  rot: number; spin: number; w: number; h: number;
  colour: string; life: number; wobble: number; round: boolean;
};

/**
 * Party poppers going off behind the page for as long as it's open. A canvas, not DOM nodes,
 * so hundreds of pieces cost one layer; it pauses while the app is hidden.
 */
export function ConfettiCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const colours = COLOUR_TOKENS.map((token) => styles.getPropertyValue(token).trim() || '#f0a03c');
    let pieces: Piece[] = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Angles aim up and inwards, so both poppers meet over the headline.
    const pop = (side: 'left' | 'right') => {
      const fromLeft = side === 'left';
      for (let i = 0; i < PIECES_PER_POP; i++) {
        const angle = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 40;
        const speed = 9 + Math.random() * 9;
        const rad = (angle * Math.PI) / 180;
        pieces.push({
          x: fromLeft ? 0 : width,
          y: height * 0.92,
          vx: Math.cos(rad) * speed * (width / 420),
          vy: Math.sin(rad) * speed * (height / 800 + 0.4),
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.3,
          w: 5 + Math.random() * 5,
          h: 8 + Math.random() * 6,
          colour: colours[i % colours.length]!,
          life: 1,
          wobble: Math.random() * Math.PI * 2,
          round: Math.random() < 0.2
        });
      }
    };

    let frame = 0;
    let lastVolley = 0;
    let nextSide: 'left' | 'right' = 'left';

    const tick = (now: number) => {
      if (now - lastVolley > VOLLEY_EVERY_MS) {
        if (lastVolley === 0) {
          pop('left');
          pop('right');
        } else {
          pop(nextSide);
          nextSide = nextSide === 'left' ? 'right' : 'left';
        }
        lastVolley = now;
      }

      ctx.clearRect(0, 0, width, height);
      pieces = pieces.filter((p) => p.life > 0 && p.y < height + 40);
      for (const p of pieces) {
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY;
        p.wobble += 0.12;
        p.x += p.vx + Math.sin(p.wobble) * 0.6;
        p.y += p.vy;
        p.rot += p.spin;
        // Fade only on the way down, so the burst itself is bright.
        if (p.vy > 0) p.life -= 0.006;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.colour;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Squashing the width fakes a ribbon flipping in 3D.
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w * Math.abs(Math.cos(p.wobble)), p.h);
        }
        ctx.restore();
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : start());

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // On <body>: inside the page, the edge stretch's transform would pin it to the page instead of the viewport.
  return createPortal(
    <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full" />,
    document.body
  );
}
