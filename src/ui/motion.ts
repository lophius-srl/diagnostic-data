import { useEffect, useRef, useState } from 'preact/hooks';

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Compte de 0 à `target` (ease-out), une fois `start` vrai. Immédiat si l'utilisateur réduit les animations. */
export function useCountUp(target: number, start: boolean, durationMs = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const done = useRef(false);

  useEffect(() => {
    if (!start) return;
    if (done.current || prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
      else done.current = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, start, durationMs]);

  return value;
}

/** Vrai dès que l'élément entre à l'écran (une seule fois). Vrai d'emblée sans IntersectionObserver. */
export function useRevealOnScroll<T extends Element>(): [preact.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined' || prefersReducedMotion());
  useEffect(() => {
    if (visible || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);
  return [ref, visible];
}
