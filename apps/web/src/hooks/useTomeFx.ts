import { useCallback, useEffect, useRef } from 'react';
import { haptic } from '@/lib/telegram';

const EMBER_EVERY_MS = 420;
const KNOCK_SPARKS = 26;
const LANDING_SPARKS = 18;
// When the landing burst fires: as `tome-enter` (1.6s) finishes its swing.
const LANDING_AT_MS = 1500;
const FLASH_MS = 180;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The sealed tome's light show: embers rising off the book, a burst as it
 * lands, and the knock when it's tapped (hop, seal flash, rays flare, burst).
 * Imperative and DOM-only — sparks are throwaway nodes animated with WAAPI.
 */
export function useTomeFx() {
  const sparksRef = useRef<HTMLDivElement>(null);
  const swayRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);

  /** One spark from (x, y) in the sparks layer, drifting by (dx, dy) as it fades. */
  const spark = useCallback((x: number, y: number, dx: number, dy: number, life: number, size: number) => {
    const layer = sparksRef.current;
    if (!layer) return;
    const node = document.createElement('span');
    node.className = 'tome-spark';
    node.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`;
    layer.appendChild(node);
    node.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 },
      ],
      { duration: life, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }
    ).onfinish = () => node.remove();
  }, []);

  /** Sparks bursting outward from the seal. */
  const burst = useCallback(
    (count: number) => {
      const layer = sparksRef.current?.getBoundingClientRect();
      const seal = sealRef.current?.getBoundingClientRect();
      if (!layer || !seal) return;
      const x = seal.left + seal.width / 2 - layer.left;
      const y = seal.top + seal.height / 2 - layer.top;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const reach = 70 + Math.random() * 110;
        spark(x, y, Math.cos(angle) * reach, Math.sin(angle) * reach - 30, 700 + Math.random() * 600, 2 + Math.random() * 2.5);
      }
    },
    [spark]
  );

  useEffect(() => {
    if (reducedMotion()) return;
    const landing = window.setTimeout(() => burst(LANDING_SPARKS), LANDING_AT_MS);
    const embers = window.setInterval(() => {
      const layer = sparksRef.current?.getBoundingClientRect();
      const book = swayRef.current?.getBoundingClientRect();
      if (document.hidden || !layer || !book) return;
      const x = book.left - layer.left + book.width * (0.15 + Math.random() * 0.7);
      const y = book.top - layer.top + book.height * (0.1 + Math.random() * 0.5);
      spark(x, y, (Math.random() - 0.5) * 40, -80 - Math.random() * 90, 2600 + Math.random() * 1800, 1.5 + Math.random() * 2);
    }, EMBER_EVERY_MS);
    return () => {
      window.clearTimeout(landing);
      window.clearInterval(embers);
    };
  }, [burst, spark]);

  /** The tap: the rig has already kicked the spring; this is everything around it. */
  const knock = useCallback(() => {
    haptic('action');
    const seal = sealRef.current;
    if (seal) {
      seal.classList.add('is-flash');
      window.setTimeout(() => seal.classList.remove('is-flash'), FLASH_MS);
    }
    if (reducedMotion()) return;
    // `translate`, not `transform`: the sway animation owns the transform.
    swayRef.current?.animate([{ translate: '0 0' }, { translate: '0 -22px', offset: 0.35 }, { translate: '0 0' }], {
      duration: 520,
      easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)',
    });
    auraRef.current?.animate([{ scale: 1 }, { scale: 1.3, offset: 0.25 }, { scale: 1 }], { duration: 1100, easing: 'ease-out' });
    burst(KNOCK_SPARKS);
  }, [burst]);

  return { sparksRef, swayRef, sealRef, auraRef, knock };
}
