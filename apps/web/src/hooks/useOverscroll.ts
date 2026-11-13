import { useEffect } from 'react';
import { queryClient } from '@/lib/queryClient';
import { haptic } from '@/lib/telegram';
import { usePullRefreshStore } from '@/stores/pullRefresh.store';
import { fetchCurrentQuestFresh, questKeys } from '@/lib/api/quest';

/** Furthest the content travels; resistance flattens toward it. */
const MAX_PULL = 150;
/** 150px of pull → 7.5% taller: visible, never warping text into mush. */
const STRETCH_PER_PX = 0.0005;
/** Pull that arms a refresh (~115px of finger travel). */
const ARM_AT = 80;
/** Where the book parks while the refetch runs. */
const REST_AT = 64;
/** A refetch from cache resolves in a frame; the book should still visibly turn a page. */
const MIN_REFRESH_MS = 700;
/** Matches the CSS settle/leave transitions in `shell.css`. */
const SETTLE_MS = 420;
const AXIS_LOCK_PX = 6;

type Edge = 'top' | 'bottom';
type PullState = 'pulling' | 'armed' | 'refreshing' | 'leaving' | 'done';

interface Gesture {
  startX: number;
  startY: number;
  lastY: number;
  axis: 'x' | 'y' | null;
  edge: Edge | null;
  /** Finger Y when the page hit its edge: pull is measured from here, so it never jumps. */
  originY: number;
  pull: number;
}

// Linear under the finger at first, flattening toward MAX_PULL like a rubber band.
const resist = (px: number) => MAX_PULL * (1 - Math.exp(-px / MAX_PULL));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const atTop = () => window.scrollY <= 0;
const atBottom = () =>
  window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;

/** Dialogs, sliders, drag lists and inner scrollers own their own gestures. */
function canStretch(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('dialog, input[type="range"], [data-no-overscroll]')) return false;
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight)
      return false;
  }
  return true;
}

/**
 * Android-style edge stretch for every screen, plus pull-to-refresh on screens
 * that call `usePullToRefresh`. Native rubber-banding stays off (`base.css`);
 * this draws its own by writing CSS variables to `<html>`, so nothing re-renders mid-gesture.
 */
export function useOverscroll(): void {
  useEffect(() => {
    const root = document.documentElement;
    let gesture: Gesture | null = null;
    let refreshing = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let pullTimer: ReturnType<typeof setTimeout> | undefined;

    const canRefresh = () => !refreshing && usePullRefreshStore.getState().owners > 0;

    function clearStretch() {
      clearTimeout(settleTimer);
      delete root.dataset.overscroll;
      delete root.dataset.overscrollSettle;
      root.style.removeProperty('--os');
    }

    function clearPull() {
      clearTimeout(pullTimer);
      delete root.dataset.pull;
      root.style.removeProperty('--pull');
      root.style.removeProperty('--pull-p');
    }

    function setPull(state: PullState, px: number) {
      clearTimeout(pullTimer);
      root.dataset.pull = state;
      root.style.setProperty('--pull', `${px}px`);
      root.style.setProperty('--pull-p', Math.min(px / ARM_AT, 1).toFixed(3));
    }

    function paint(edge: Edge, pull: number) {
      clearTimeout(settleTimer);
      delete root.dataset.overscrollSettle;
      root.dataset.overscroll = edge;
      root.style.setProperty('--os', (pull * STRETCH_PER_PX).toFixed(4));

      if (edge !== 'top' || !canRefresh()) return;
      const armed = pull >= ARM_AT;
      if (armed && root.dataset.pull !== 'armed') haptic('select');
      setPull(armed ? 'armed' : 'pulling', pull);
    }

    // Spring back; the attribute goes once the spring is done, taking the transform with it.
    function settleStretch() {
      root.dataset.overscrollSettle = '';
      root.style.setProperty('--os', '0');
      settleTimer = setTimeout(clearStretch, SETTLE_MS);
    }

    async function refresh() {
      refreshing = true;
      setPull('refreshing', REST_AT);
      // refetchQueries doesn't throw; a failed fetch shows in the screen's own error state.
      const current = questKeys.current();
      const isCurrentQuest = (key: readonly unknown[]) =>
        JSON.stringify(key) === JSON.stringify(current);
      const showsQuest = queryClient
        .getQueryCache()
        .findAll({ type: 'active' })
        .some((query) => isCurrentQuest(query.queryKey));
      await Promise.all([
        queryClient.refetchQueries({
          type: 'active',
          predicate: (query) => !isCurrentQuest(query.queryKey)
        }),
        // The current quest skips the HTTP cache: a pull right after a reveal must show the book.
        showsQuest ? fetchCurrentQuestFresh(queryClient) : null,
        wait(MIN_REFRESH_MS)
      ]);
      setPull('done', REST_AT);
      pullTimer = setTimeout(() => {
        clearPull();
        refreshing = false;
      }, SETTLE_MS);
    }

    function release() {
      const ended = gesture;
      gesture = null;
      if (!ended?.edge) return;
      settleStretch();

      const state = root.dataset.pull;
      if (state === 'armed') void refresh();
      else if (state === 'pulling') {
        setPull('leaving', 0);
        pullTimer = setTimeout(clearPull, SETTLE_MS);
      }
    }

    function onStart(event: TouchEvent) {
      const touch = event.touches.length === 1 ? event.touches[0] : undefined;
      if (!touch) return release();
      if (!canStretch(event.target)) return;
      const { clientX, clientY } = touch;
      gesture = {
        startX: clientX,
        startY: clientY,
        lastY: clientY,
        axis: null,
        edge: null,
        originY: 0,
        pull: 0
      };
    }

    function onMove(event: TouchEvent) {
      const touch = event.touches.length === 1 ? event.touches[0] : undefined;
      if (!gesture || !touch) return;
      const { clientX, clientY: y } = touch;

      if (!gesture.axis) {
        const dx = clientX - gesture.startX;
        const dy = y - gesture.startY;
        if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return;
        gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (gesture.axis === 'x') return;

      // Engage the moment the page runs out of scroll, even mid-gesture.
      if (!gesture.edge) {
        const edge: Edge | null =
          y > gesture.lastY && atTop() ? 'top' : y < gesture.lastY && atBottom() ? 'bottom' : null;
        gesture.lastY = y;
        if (!edge) return;
        gesture.edge = edge;
        gesture.originY = y;
      }
      gesture.lastY = y;

      const raw = gesture.edge === 'top' ? y - gesture.originY : gesture.originY - y;
      // Finger went back past the edge: hand the gesture back to native scrolling.
      if (raw <= 0) {
        gesture.edge = null;
        clearStretch();
        if (!refreshing) clearPull();
        return;
      }

      if (event.cancelable) event.preventDefault();
      gesture.pull = resist(raw);
      paint(gesture.edge, gesture.pull);
    }

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', release);
    document.addEventListener('touchcancel', release);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', release);
      document.removeEventListener('touchcancel', release);
      clearStretch();
      clearPull();
    };
  }, []);
}
