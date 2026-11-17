import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookCover, BookSpine } from './components/BookArtwork';
import { BookReader } from './components/BookReader';
import { BOOKS, Book, JOURNAL_ARTICLES, toArabicDigits } from './data/books';

const BOOK_COUNT = BOOKS.length; // 24 unique books
const TOTAL_SLOTS = BOOK_COUNT * 2; // 48 virtual slots for seamless looping
const DEFAULT_BOOK_INDEX = BOOKS.findIndex((b) => b.id === 'noon-book');
const START_SLOT = (DEFAULT_BOOK_INDEX >= 0 ? DEFAULT_BOOK_INDEX : 10) + BOOK_COUNT;
const YEAR_MIN = 1955;
const YEAR_MAX = 1990;

type OverlayMode = null | 'books' | 'about' | 'journal';

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

export default function App() {
  const initialIdx = DEFAULT_BOOK_INDEX >= 0 ? DEFAULT_BOOK_INDEX : 10;
  const [activeBookIdx, setActiveBookIdx] = useState<number>(initialIdx);
  const [readerOpen, setReaderOpen] = useState<boolean>(false);
  const [readerBook, setReaderBook] = useState<Book>(BOOKS[initialIdx]);
  const [overlay, setOverlay] = useState<OverlayMode>(null);
  const [genreFilter, setGenreFilter] = useState<string>('الكل');
  const [copiedNotice, setCopiedNotice] = useState<string>('');

  // DOM Refs for rAF physics & WAAPI
  const probeRef = useRef<HTMLDivElement | null>(null);
  const shelfRef = useRef<HTMLElement | null>(null);
  const tapeRefs = useRef<Array<HTMLDivElement | null>>([]);
  const spineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const coverRefs = useRef<Array<HTMLDivElement | null>>([]);
  const openRingRef = useRef<HTMLButtonElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);

  // Caption masks
  const capTitleMaskRef = useRef<HTMLDivElement | null>(null);
  const capSubMaskRef = useRef<HTMLDivElement | null>(null);
  const capMetaMaskRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    s: START_SLOT,
    T: START_SLOT,
    lifts: new Float32Array(TOTAL_SLOTS),
    hoveredV: -1,
    dotYear: BOOKS[initialIdx].year,
    mx: typeof window !== 'undefined' ? window.innerWidth / 2 : 720,
    my: typeof window !== 'undefined' ? window.innerHeight / 2 : 450,
    cx: typeof window !== 'undefined' ? window.innerWidth / 2 : 720,
    cyCur: typeof window !== 'undefined' ? window.innerHeight / 2 : 450,
    tiltX: 0,
    tiltY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartT: START_SLOT,
    didDrag: false,
    lastShownIdx: initialIdx,
    readerOpen: false,
    overlayOpen: false,
    reducedMotion: false,
    H: 360,
    ws: 61,
    d: 190,
    gap: 12,
    U: 468,
    P: 1400,
    XS: new Float32Array(1),
    W: 1440,
    VH: 900,
    cyPx: 333,
  });

  stateRef.current.readerOpen = readerOpen;
  stateRef.current.overlayOpen = overlay !== null;

  const genres = useMemo(() => {
    const unique = Array.from(new Set(BOOKS.map((b) => b.genre)));
    return ['الكل', ...unique];
  }, []);

  const filteredBooks = useMemo(() => {
    if (genreFilter === 'الكل') return BOOKS;
    return BOOKS.filter((b) => b.genre === genreFilter);
  }, [genreFilter]);

  const measureGeometry = () => {
    const st = stateRef.current;
    const probeH = probeRef.current?.getBoundingClientRect().height || 360;
    const W = window.innerWidth;
    const VH = window.innerHeight;
    const H = probeH;
    const ws = (H * 142) / 840;
    const d = (H * 474) / 900;
    const gap = H * 0.035;
    const U = W < 768 ? H * 1.05 : H * 1.3;
    const cyFrac = W < 768 ? 0.4 : 0.37;

    const maxSteps = Math.ceil((3 * U) / 2) + 2;
    const XS = new Float32Array(maxSteps);
    let acc = 0;
    for (let i = 0; i < maxSteps; i++) {
      XS[i] = acc;
      const u = i * 2;
      acc += 2 / (1 + Math.pow(u / U, 1.6));
    }

    st.H = H;
    st.ws = ws;
    st.d = d;
    st.gap = gap;
    st.U = U;
    st.XS = XS;
    st.W = W;
    st.VH = VH;
    st.cyPx = VH * cyFrac;

    for (let v = 0; v < TOTAL_SLOTS; v++) {
      const sp = spineRefs.current[v];
      const cv = coverRefs.current[v];
      if (sp) {
        sp.style.width = `${ws}px`;
        sp.style.marginLeft = `${-ws / 2}px`;
        sp.style.transform = `translateZ(${d / 2}px)`;
      }
      if (cv) {
        cv.style.width = `${d}px`;
        cv.style.marginLeft = `${-d / 2}px`;
        cv.style.transform = `rotateY(90deg) translateZ(${ws / 2}px)`;
      }
    }
  };

  const applyShelfTransforms = (dt: number) => {
    const st = stateRef.current;
    const { H, ws, d, gap, U, P, XS, s, T, tiltX, tiltY, lifts, hoveredV, reducedMotion } = st;

    const rel = (v: number, pos: number) => {
      let r = (((v - pos) % TOTAL_SLOTS) + TOTAL_SLOTS) % TOTAL_SLOTS;
      if (r >= BOOK_COUNT) r -= TOTAL_SLOTS;
      return r;
    };

    const B = (r: number) => {
      if (Math.abs(r) < 1) return (r + Math.sin(Math.PI * r) / Math.PI) / 2;
      return r < 0 ? -0.5 : 0.5;
    };

    const F = (r: number) => r * (ws + gap) + (d - ws + 1.4 * gap) * B(r);
    const scl = (u: number) => 1 / (1 + Math.pow(Math.abs(u) / U, 1.6));

    const xsc = (u: number) => {
      const sign = u < 0 ? -1 : 1;
      const au = Math.abs(u);
      const exactIdx = au / 2;
      const idx0 = Math.min(XS.length - 1, Math.floor(exactIdx));
      const idx1 = Math.min(XS.length - 1, idx0 + 1);
      const frac = exactIdx - idx0;
      const val = XS[idx0] + (XS[idx1] - XS[idx0]) * frac;
      return sign * val;
    };

    const liftRate = reducedMotion ? 1 : 1 - Math.exp(-12 * dt);

    for (let v = 0; v < TOTAL_SLOTS; v++) {
      const tapeEl = tapeRefs.current[v];
      if (!tapeEl) continue;

      const r = rel(v, s);
      const o = smoothstep(Math.max(0, 1 - Math.abs(r)));
      const u = F(r);

      if (Math.abs(u) > U * 1.95) {
        tapeEl.style.display = 'none';
        continue;
      }
      tapeEl.style.display = 'block';

      const targetLift =
        hoveredV === v && Math.abs(r) > 0.5 && !st.readerOpen && !st.overlayOpen ? 1 : 0;
      lifts[v] += (targetLift - lifts[v]) * liftRate;
      const lift = lifts[v];

      const sc = scl(u);
      const k = 1 / sc;

      const z = P * (1 - k) + o * H * 0.1;
      const x = xsc(u) * k;
      const y = (H * 0.5 * (1 - sc) * 0.42 + o * H * 0.012 - lift * H * 0.05) * k;

      const signU = u < 0 ? -1 : 1;
      const rotY = signU * Math.min(1, Math.abs(u) / U) * 26 * (1 - o) - 90 * o + tiltY * o;
      const rotX = tiltX * o;

      tapeEl.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      tapeEl.style.zIndex = String(Math.round(3000 + z));

      const sp = spineRefs.current[v];
      const cv = coverRefs.current[v];
      if (sp) {
        const spShade = Math.min(0.6, o * 0.55 + (1 - sc) * 0.32);
        sp.style.setProperty('--shade', spShade.toFixed(3));
      }
      if (cv) {
        const cvShade = (1 - o) * 0.82;
        cv.style.setProperty('--shade', cvShade.toFixed(3));
      }
    }

    if (openRingRef.current) {
      const prScale =
        st.readerOpen || st.overlayOpen
          ? 0
          : smoothstep(Math.max(0, 1 - Math.abs(T - s) * 3));
      const leftPos = Math.max(12, st.W / 2 - d / 2 - 8);
      const topPos = st.cyPx + 0.36 * H;
      openRingRef.current.style.left = `${leftPos}px`;
      openRingRef.current.style.top = `${topPos}px`;
      openRingRef.current.style.transform = `scale(${prScale})`;
      openRingRef.current.style.pointerEvents = prScale > 0.5 ? 'auto' : 'none';
    }
  };

  const swapCaptionLine = (
    maskEl: HTMLDivElement | null,
    text: string,
    dir: number,
    instant: boolean
  ) => {
    if (!maskEl) return;
    const oldSpans = Array.from(maskEl.children) as HTMLElement[];
    const nextSpan = document.createElement('span');
    nextSpan.textContent = text;
    maskEl.appendChild(nextSpan);

    if (instant) {
      oldSpans.forEach((el) => el.remove());
      return;
    }

    const easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
    const duration = 650;

    oldSpans.forEach((oldEl) => {
      const cs = getComputedStyle(oldEl);
      const fromTransform = cs.transform === 'none' ? 'translateY(0%)' : cs.transform;
      oldEl.getAnimations().forEach((a) => a.cancel());
      const anim = oldEl.animate(
        [{ transform: fromTransform }, { transform: `translateY(${-dir * 105}%)` }],
        { duration, easing, fill: 'both' }
      );
      anim.onfinish = () => oldEl.remove();
    });

    nextSpan.animate(
      [{ transform: `translateY(${dir * 105}%)` }, { transform: 'translateY(0%)' }],
      { duration, easing, fill: 'both' }
    );
  };

  useEffect(() => {
    const st = stateRef.current;
    const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    st.reducedMotion = mqReduced.matches;
    const onMqChange = (e: MediaQueryListEvent) => {
      st.reducedMotion = e.matches;
    };
    mqReduced.addEventListener('change', onMqChange);

    measureGeometry();
    applyShelfTransforms(0.016);

    const initBook = BOOKS[initialIdx];
    if (capTitleMaskRef.current) {
      capTitleMaskRef.current.innerHTML = '';
      const s0 = document.createElement('span');
      s0.textContent = initBook.title;
      capTitleMaskRef.current.appendChild(s0);
    }
    if (capSubMaskRef.current) {
      capSubMaskRef.current.innerHTML = '';
      const s1 = document.createElement('span');
      s1.textContent = `${initBook.author} · ${initBook.subtitle}`;
      capSubMaskRef.current.appendChild(s1);
    }
    if (capMetaMaskRef.current) {
      capMetaMaskRef.current.innerHTML = '';
      const s2 = document.createElement('span');
      s2.textContent = `${toArabicDigits(initBook.year)} — ${initBook.genre} · ${toArabicDigits(
        initBook.pages.length
      )} صفحات`;
      capMetaMaskRef.current.appendChild(s2);
    }
    st.lastShownIdx = initialIdx;

    const onResize = () => {
      measureGeometry();
      applyShelfTransforms(0.016);
    };
    window.addEventListener('resize', onResize);

    const onPointerMove = (e: PointerEvent) => {
      st.mx = e.clientX;
      st.my = e.clientY;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let rafId = 0;
    let prevTime = performance.now();

    const loop = (now: number) => {
      const rawDt = (now - prevTime) / 1000;
      prevTime = now;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      const k = st.dragging ? 18 : 5.2;
      if (st.reducedMotion) {
        st.s = st.T;
      } else {
        st.s += (st.T - st.s) * (1 - Math.exp(-k * dt));
      }

      // Seamless loop wrapping every 24 books
      if (st.s >= 42) {
        st.s -= BOOK_COUNT;
        st.T -= BOOK_COUNT;
      } else if (st.s < 6) {
        st.s += BOOK_COUNT;
        st.T += BOOK_COUNT;
      }

      const roundedIdx = ((Math.round(st.s) % BOOK_COUNT) + BOOK_COUNT) % BOOK_COUNT;
      if (roundedIdx !== st.lastShownIdx) {
        const dir = Math.sign(st.T - st.s) || 1;
        st.lastShownIdx = roundedIdx;
        const book = BOOKS[roundedIdx];
        setActiveBookIdx(roundedIdx);
        swapCaptionLine(capTitleMaskRef.current, book.title, dir, st.reducedMotion);
        swapCaptionLine(
          capSubMaskRef.current,
          `${book.author} · ${book.subtitle}`,
          dir,
          st.reducedMotion
        );
        swapCaptionLine(
          capMetaMaskRef.current,
          `${toArabicDigits(book.year)} — ${book.genre} · ${toArabicDigits(
            book.pages.length
          )} صفحات`,
          dir,
          st.reducedMotion
        );
      }

      // Timeline dot interpolation across 24 chronological books
      const f0 = Math.floor(st.s);
      const frac = st.s - f0;
      const i0 = ((f0 % BOOK_COUNT) + BOOK_COUNT) % BOOK_COUNT;
      const i1 = (i0 + 1) % BOOK_COUNT;
      const y0 = BOOKS[i0].year;
      const y1 = BOOKS[i1].year;
      const targetYear =
        i0 === BOOK_COUNT - 1 && i1 === 0 ? (frac < 0.5 ? y0 : y1) : y0 + (y1 - y0) * frac;

      if (Math.abs(targetYear - st.dotYear) > 6 || st.reducedMotion) {
        st.dotYear = targetYear;
      } else {
        st.dotYear += (targetYear - st.dotYear) * (1 - Math.exp(-14 * dt));
      }
      if (dotRef.current) {
        const pct = ((st.dotYear - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
        dotRef.current.style.left = `${pct}%`;
      }

      const onCover =
        Math.abs(st.mx - st.W / 2) < 0.55 * st.d &&
        Math.abs(st.my - st.cyPx) < 0.55 * st.H &&
        Math.abs(st.T - st.s) < 0.3 &&
        !st.readerOpen &&
        !st.overlayOpen;

      const targetTiltY = onCover
        ? ((st.mx - st.W / 2) / (0.55 * st.d)) * 8
        : ((st.mx - st.W / 2) / Math.max(1, st.W)) * 4;
      const targetTiltX = onCover ? -((st.my - st.cyPx) / (st.H / 2)) * 5 : 0;

      const tiltRate = st.reducedMotion ? 1 : 1 - Math.exp(-7 * dt);
      st.tiltY += (targetTiltY - st.tiltY) * tiltRate;
      st.tiltX += (targetTiltX - st.tiltX) * tiltRate;

      applyShelfTransforms(dt);

      if (cursorRef.current) {
        const cRate = st.reducedMotion ? 1 : 1 - Math.exp(-16 * dt);
        st.cx += (st.mx - st.cx) * cRate;
        st.cyCur += (st.my - st.cyCur) * cRate;
        cursorRef.current.style.transform = `translate3d(${st.cx}px, ${st.cyCur}px, 0)`;

        const hitEl = document.elementFromPoint(st.mx, st.my);
        const isBtn = Boolean(hitEl?.closest('button, a, .tl-hit'));
        const isOpenRing = Boolean(hitEl?.closest('.play-ring'));
        const isTape = Boolean(hitEl?.closest('.tape'));

        cursorRef.current.classList.toggle('btn', isBtn);
        cursorRef.current.classList.toggle('open', onCover && !isBtn && !isOpenRing);
        cursorRef.current.classList.toggle('spine', !onCover && !isBtn && isTape);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      mqReduced.removeEventListener('change', onMqChange);
    };
  }, []);

  const getActiveCoverElement = (): HTMLDivElement | null => {
    const st = stateRef.current;
    let bestV = 0;
    let bestDist = Infinity;
    for (let v = 0; v < TOTAL_SLOTS; v++) {
      let r = (((v - st.s) % TOTAL_SLOTS) + TOTAL_SLOTS) % TOTAL_SLOTS;
      if (r >= BOOK_COUNT) r -= TOTAL_SLOTS;
      const dist = Math.abs(r);
      if (dist < bestDist) {
        bestDist = dist;
        bestV = v;
      }
    }
    return coverRefs.current[bestV];
  };

  // Open the 3D Two-Page Open Book Reader straight from the clicked cover
  const openBookReader = (explicitBook?: Book) => {
    const st = stateRef.current;
    if (st.readerOpen) return;
    st.T = Math.round(st.T);
    st.s = st.T;
    st.tiltX = 0;
    st.tiltY = 0;
    applyShelfTransforms(0.016);

    const idx = ((Math.round(st.s) % BOOK_COUNT) + BOOK_COUNT) % BOOK_COUNT;
    const bookToOpen = explicitBook || BOOKS[idx];
    setActiveBookIdx(bookToOpen.index);
    setReaderBook(bookToOpen);
    setReaderOpen(true);
  };

  // Animate Reader growing out of cover's rect via clip-path
  useLayoutEffect(() => {
    if (!readerOpen) return;
    const st = stateRef.current;
    const sheetEl = readerRef.current;
    const coverEl = getActiveCoverElement();
    if (!sheetEl) return;

    sheetEl.getAnimations().forEach((a) => a.cancel());

    const rect = coverEl?.getBoundingClientRect();
    const hasRect = rect && rect.width > 10 && rect.height > 10;
    const fromClip = hasRect
      ? `inset(${rect.top}px ${Math.max(0, window.innerWidth - rect.right)}px ${Math.max(
          0,
          window.innerHeight - rect.bottom
        )}px ${rect.left}px round 4px)`
      : 'inset(22% 36% 22% 36% round 4px)';

    sheetEl.animate(
      [{ clipPath: fromClip }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }],
      {
        duration: st.reducedMotion ? 1 : 900,
        easing: 'cubic-bezier(0.76, 0, 0.18, 1)',
        fill: 'both',
      }
    );
  }, [readerOpen, readerBook.id]);

  const closeBookReader = () => {
    const st = stateRef.current;
    const sheetEl = readerRef.current;
    if (!readerOpen || !sheetEl) return;

    const coverEl = getActiveCoverElement();
    const rect = coverEl?.getBoundingClientRect();
    const hasRect = rect && rect.width > 10 && rect.height > 10;
    const toClip = hasRect
      ? `inset(${rect.top}px ${Math.max(0, window.innerWidth - rect.right)}px ${Math.max(
          0,
          window.innerHeight - rect.bottom
        )}px ${rect.left}px round 4px)`
      : 'inset(22% 36% 22% 36% round 4px)';

    sheetEl.getAnimations().forEach((a) => a.cancel());
    const anim = sheetEl.animate(
      [{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: toClip }],
      {
        duration: st.reducedMotion ? 1 : 780,
        easing: 'cubic-bezier(0.76, 0, 0.18, 1)',
        fill: 'both',
      }
    );

    anim.onfinish = () => {
      sheetEl.getAnimations().forEach((a) => a.cancel());
      setReaderOpen(false);
    };
  };

  const stepShelf = (delta: number) => {
    const st = stateRef.current;
    if (st.readerOpen || st.overlayOpen) return;
    st.T = Math.round(st.T) + delta;
  };

  const jumpToBook = (targetIdx: number) => {
    const st = stateRef.current;
    const currentIdx = ((Math.round(st.T) % BOOK_COUNT) + BOOK_COUNT) % BOOK_COUNT;
    let diff = targetIdx - currentIdx;
    if (diff > BOOK_COUNT / 2) diff -= BOOK_COUNT;
    if (diff < -BOOK_COUNT / 2) diff += BOOK_COUNT;
    st.T = Math.round(st.T) + diff;
  };

  // Keyboard shortcuts on main shelf
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlay) {
        setOverlay(null);
        return;
      }
      if (overlay || readerOpen) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepShelf(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepShelf(1);
      } else if (e.key === 'Enter' && document.activeElement?.tagName === 'BODY') {
        openBookReader();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readerOpen, overlay]);

  // Shelf drag & wheel physics
  useEffect(() => {
    const shelfEl = shelfRef.current;
    if (!shelfEl) return;

    let wheelTimer: number | null = null;

    const onPointerDown = (e: PointerEvent) => {
      const st = stateRef.current;
      if (st.readerOpen || st.overlayOpen) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      st.dragging = true;
      st.dragStartX = e.clientX;
      st.dragStartT = st.T;
      st.didDrag = false;
      shelfEl.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const st = stateRef.current;
      if (!st.dragging) return;
      const dx = e.clientX - st.dragStartX;
      if (Math.abs(dx) > 5) st.didDrag = true;
      if (st.didDrag) {
        st.T = st.dragStartT - dx / (st.ws + st.gap);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const st = stateRef.current;
      if (!st.dragging) return;
      st.dragging = false;
      if (shelfEl.hasPointerCapture(e.pointerId)) {
        shelfEl.releasePointerCapture(e.pointerId);
      }
      if (st.didDrag) st.T = Math.round(st.T);
      window.setTimeout(() => {
        st.didDrag = false;
      }, 40);
    };

    const onWheel = (e: WheelEvent) => {
      const st = stateRef.current;
      if (st.readerOpen || st.overlayOpen) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      st.T += (delta / (st.ws + st.gap)) * 0.5;
      if (wheelTimer !== null) window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        st.T = Math.round(st.T);
      }, 160);
    };

    shelfEl.addEventListener('pointerdown', onPointerDown);
    shelfEl.addEventListener('pointermove', onPointerMove);
    shelfEl.addEventListener('pointerup', onPointerUp);
    shelfEl.addEventListener('pointercancel', onPointerUp);
    shelfEl.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      shelfEl.removeEventListener('pointerdown', onPointerDown);
      shelfEl.removeEventListener('pointermove', onPointerMove);
      shelfEl.removeEventListener('pointerup', onPointerUp);
      shelfEl.removeEventListener('pointercancel', onPointerUp);
      shelfEl.removeEventListener('wheel', onWheel);
      if (wheelTimer !== null) window.clearTimeout(wheelTimer);
    };
  }, []);

  const handleBookClick = (v: number) => {
    const st = stateRef.current;
    if (st.didDrag || st.readerOpen || st.overlayOpen) return;
    let r = (((v - st.s) % TOTAL_SLOTS) + TOTAL_SLOTS) % TOTAL_SLOTS;
    if (r >= BOOK_COUNT) r -= TOTAL_SLOTS;
    if (Math.abs(r) < 0.35) {
      openBookReader(BOOKS[v % BOOK_COUNT]);
    } else {
      st.T = Math.round(st.T + r);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = timelineRef.current;
    if (!el || readerOpen || overlay) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickedYear = YEAR_MIN + frac * (YEAR_MAX - YEAR_MIN);

    let bestIdx = 0;
    let bestDist = Infinity;
    BOOKS.forEach((b, idx) => {
      const dist = Math.abs(b.year - clickedYear);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    jumpToBook(bestIdx);
  };

  const handleCopyShare = (platform: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setCopiedNotice(`تم نسخ رابط المكتبة (${platform})`);
    window.setTimeout(() => setCopiedNotice(''), 2400);
  };

  const years = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

  return (
    <>
      <div ref={probeRef} className="height-probe" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="brand-group">
          <a
            href="#top"
            className="brand-link"
            onClick={(e) => {
              e.preventDefault();
              setOverlay(null);
              if (readerOpen) closeBookReader();
            }}
          >
            مكتبة الرقعة
          </a>
          <span className="brand-rule" aria-hidden="true" />
          <span className="brand-sub">خزانة الكتب العربية ({toArabicDigits(BOOK_COUNT)} كتاباً)</span>
        </div>

        <nav className="nav-group" aria-label="التنقل الرئيسي">
          <div className="nav-links">
            <button
              type="button"
              className="nav-link"
              aria-current={overlay === 'books' ? 'page' : undefined}
              onClick={() => setOverlay(overlay === 'books' ? null : 'books')}
            >
              الكتب
            </button>
            <button
              type="button"
              className="nav-link"
              aria-current={overlay === 'about' ? 'page' : undefined}
              onClick={() => setOverlay(overlay === 'about' ? null : 'about')}
            >
              عن المكتبة
            </button>
            <button
              type="button"
              className="nav-link"
              aria-current={overlay === 'journal' ? 'page' : undefined}
              onClick={() => setOverlay(overlay === 'journal' ? null : 'journal')}
            >
              المقالات
            </button>
          </div>

          <button
            type="button"
            className="burger-btn"
            aria-label="فهرس الكتب الكامل"
            onClick={() => setOverlay(overlay === 'books' ? null : 'books')}
          >
            <span className="burger-line" />
            <span className="burger-line" />
          </button>
        </nav>
      </header>

      {/* Background giant halftone Arabic Ruq'ah calligraphy */}
      <div className="bg-cal bg-cal-right" aria-hidden="true">
        <span className="bg-cal-word">ذاكرة</span>
        <span className="bg-cal-word">الكتب</span>
      </div>
      <div className="bg-cal bg-cal-left" aria-hidden="true">
        <span className="bg-cal-word">صفحات</span>
        <span className="bg-cal-word">الزمن</span>
      </div>

      <div className="floor-shadow" aria-hidden="true" />

      {/* 3D Curved Bookshelf */}
      <main>
        <section
          ref={shelfRef}
          className="shelf"
          aria-label="رف الكتب ثلاثي الأبعاد"
        >
          <div className="stage">
            {Array.from({ length: TOTAL_SLOTS }, (_, v) => {
              const book = BOOKS[v % BOOK_COUNT];
              return (
                <div
                  key={v}
                  ref={(el) => {
                    tapeRefs.current[v] = el;
                  }}
                  className="tape"
                  onPointerEnter={() => {
                    stateRef.current.hoveredV = v;
                  }}
                  onPointerLeave={() => {
                    if (stateRef.current.hoveredV === v) {
                      stateRef.current.hoveredV = -1;
                    }
                  }}
                  onClick={() => handleBookClick(v)}
                >
                  <div
                    ref={(el) => {
                      spineRefs.current[v] = el;
                    }}
                    className="face sp"
                    title={book.title}
                  >
                    <BookSpine book={book} />
                  </div>
                  <div
                    ref={(el) => {
                      coverRefs.current[v] = el;
                    }}
                    className="face cv"
                  >
                    <BookCover book={book} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Open Book button ring at lower-left corner of settled cover */}
        <button
          ref={openRingRef}
          type="button"
          className="play-ring"
          aria-label={`افتح كتاب ${BOOKS[activeBookIdx].title} للقراءة`}
          onClick={() => openBookReader(BOOKS[activeBookIdx])}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </button>

        {/* Caption under cover */}
        <div className="caption" aria-live="polite">
          <div ref={capTitleMaskRef} className="cap-mask cap-title" />
          <div ref={capSubMaskRef} className="cap-mask cap-sub" />
          <div className="cap-rule" aria-hidden="true" />
          <div ref={capMetaMaskRef} className="cap-mask cap-meta" />
        </div>

        {/* Left & Right shelf arrows */}
        <button
          type="button"
          className="arrow-btn prev"
          aria-label="الكتاب السابق"
          onClick={() => stepShelf(-1)}
        >
          <svg
            width="24"
            height="12"
            viewBox="0 0 24 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            aria-hidden="true"
          >
            <path d="M6 1L1 6l5 5M1 6h23" />
          </svg>
        </button>

        <button
          type="button"
          className="arrow-btn next"
          aria-label="الكتاب التالي"
          onClick={() => stepShelf(1)}
        >
          <svg
            width="24"
            height="12"
            viewBox="0 0 24 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            aria-hidden="true"
          >
            <path d="M18 1l5 5-5 5M23 6H0" />
          </svg>
        </button>

        {/* 1955–1990 Timeline Ruler */}
        <div
          ref={timelineRef}
          className="timeline"
          role="slider"
          aria-label="الخط الزمني للطبعات من ١٩٥٥ إلى ١٩٩٠"
          aria-valuemin={YEAR_MIN}
          aria-valuemax={YEAR_MAX}
          aria-valuenow={BOOKS[activeBookIdx].year}
        >
          <div className="tl-line" />
          {years.map((yr) => {
            const pct = ((yr - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
            const isMajor = yr % 5 === 0;
            const majorIdx = (yr - YEAR_MIN) / 5;
            return (
              <React.Fragment key={yr}>
                <div
                  className={`tl-tick ${isMajor ? 'major' : 'minor'}`}
                  style={{ left: `${pct}%` }}
                />
                {isMajor && (
                  <span
                    className={`tl-year ${yr === YEAR_MIN ? 'first' : ''} ${
                      yr === YEAR_MAX ? 'last' : ''
                    } ${majorIdx % 2 === 1 ? 'odd-major' : ''}`}
                    style={{ left: `${pct}%` }}
                  >
                    {toArabicDigits(yr)}
                  </span>
                )}
              </React.Fragment>
            );
          })}
          <div ref={dotRef} className="tl-dot" />
          <div className="tl-hit" onClick={handleTimelineClick} />
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <span className="footer-text">
          © مكتبة الرقعة · تصميم وتطوير:{' '}
          <button
            type="button"
            onClick={() => setOverlay('about')}
            className="underline decoration-[#1F3FB0]/40 underline-offset-4 hover:decoration-[#1F3FB0] font-bold"
          >
            المهندس عبدالرحمن حمودة
          </button>
          {copiedNotice ? ` — ${copiedNotice}` : ''}
        </span>
        <div className="footer-links">
          <button type="button" onClick={() => handleCopyShare('فيسبوك')}>
            فيسبوك
          </button>
          <span aria-hidden="true">/</span>
          <button type="button" onClick={() => handleCopyShare('إكس')}>
            إكس
          </button>
        </div>
      </footer>

      {/* Real 3D Two-Page Open Book Reader */}
      <BookReader
        book={readerBook}
        isOpen={readerOpen}
        onClose={closeBookReader}
        readerRef={readerRef}
      />

      {/* Secondary Archive Sheets: Books Index / About / Journal */}
      {overlay && (
        <section className="archive-overlay" aria-label="صفحة المكتبة">
          <button
            type="button"
            className="box archive-close-btn"
            onClick={() => setOverlay(null)}
          >
            إغلاق
          </button>

          <div className="archive-brand">
            <span className="brand-link">مكتبة الرقعة</span>
            <span className="brand-rule" aria-hidden="true" />
            <span className="brand-sub">
              {overlay === 'books' && `فهرس الكتب (${toArabicDigits(BOOKS.length)} كتاباً)`}
              {overlay === 'about' && 'عن المكتبة والمجموعة'}
              {overlay === 'journal' && 'مقالات في الورق والخط'}
            </span>
          </div>

          {overlay === 'books' && (
            <div className="mx-auto max-w-6xl pt-8">
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-4xl font-bold text-[#1F3FB0] md:text-5xl">
                  فهرس الخزانة الكاملة ({toArabicDigits(BOOKS.length)} كتاباً مقروءاً)
                </h2>

                {/* Clean genre filter tabs */}
                <div className="flex flex-wrap items-center gap-2">
                  {genres.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenreFilter(g)}
                      className={`px-3 py-1.5 text-base border transition-colors ${
                        genreFilter === g
                          ? 'border-[#1F3FB0] bg-[#1F3FB0] text-[#F3F0EA]'
                          : 'border-[#141414]/25 text-[#141414] hover:border-[#1F3FB0]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredBooks.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      setOverlay(null);
                      jumpToBook(book.index);
                      openBookReader(book);
                    }}
                    className="group flex items-start gap-4 border-b border-[#141414]/15 pb-5 text-right transition-colors hover:border-[#1F3FB0]"
                  >
                    <div className="h-32 w-20 shrink-0 overflow-hidden rounded-xs shadow-sm">
                      <BookCover book={book} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm text-[#6D6A63]">
                        {toArabicDigits(book.year)} · {book.genre} ·{' '}
                        {toArabicDigits(book.pages.length)} صفحات
                      </span>
                      <span className="text-2xl font-bold text-[#1F3FB0] group-hover:underline">
                        {book.title}
                      </span>
                      <span className="text-base text-[#141414]">{book.author}</span>
                      <span className="text-sm text-[#6D6A63]">{book.subtitle}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {overlay === 'about' && (
            <div className="mx-auto flex max-w-5xl flex-col gap-12 pt-8">
              {/* Designer Spotlight */}
              <div className="grid grid-cols-1 items-center gap-8 border-b border-[#141414]/20 pb-10 md:grid-cols-[220px_1fr]">
                <div className="mx-auto h-64 w-52 overflow-hidden border border-[#141414]/30 bg-[#ECE8E0] shadow-md md:mx-0">
                  <img
                    src="/assets/aistudio/000_6469a73a.png"
                    alt="المهندس عبدالرحمن حمودة — مصمم الموقع"
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-base text-[#1F3FB0]">مصمم ومطور الموقع</span>
                  <h2 className="text-4xl font-bold leading-snug text-[#1F3FB0] md:text-5xl">
                    المهندس عبدالرحمن حمودة
                  </h2>
                  <p className="text-2xl leading-relaxed text-[#141414]">
                    تم تصميم وبرمجة «مكتبة الرقعة» على يد المهندس عبدالرحمن حمودة لتقديم تجربة عربية أصيلة للكتاب الورقي التفاعلي، تجمع بين جمال خط الرقعة والرف المنحني ثلاثي الأبعاد وتقليب الصفحات المتقابلة.
                  </p>
                </div>
              </div>

              {/* Library Overview & Stats */}
              <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <span className="text-base text-[#1F3FB0]">عن خزانة الكتب</span>
                  <h3 className="text-3xl font-bold leading-snug text-[#141414]">
                    مكتبة الرقعة: تجربة الكتاب الورقي الحي
                  </h3>
                  <p className="text-xl leading-relaxed text-[#6D6A63]">
                    تجمع هذه الخزانة أربعة وعشرين كتاباً مختاراً من روائع الأدب، الفلسفة، الرحلات، والشعر العربي، مصفوفة لتُفتح وتُقرأ ككتب ورقية حقيقية بصفحتين متقابلتين مع إمكانية تكبير الخط وتصفح الفصول.
                  </p>
                </div>
                <div className="flex flex-col justify-center gap-6 border-t border-[#141414]/20 pt-6 md:border-t-0 md:border-r md:pr-8 md:pt-0">
                  <div>
                    <div className="text-base text-[#6D6A63]">عدد الكتب المتاحة للقراءة</div>
                    <div className="text-3xl font-bold text-[#1F3FB0]">
                      {toArabicDigits(BOOKS.length)} كتاباً كاملاً
                    </div>
                  </div>
                  <div>
                    <div className="text-base text-[#6D6A63]">إجمالي الصفحات المقروءة</div>
                    <div className="text-3xl font-bold text-[#1F3FB0]">
                      {toArabicDigits(BOOKS.reduce((acc, b) => acc + b.pages.length, 0))} صفحة
                    </div>
                  </div>
                  <div>
                    <div className="text-base text-[#6D6A63]">الخط المعتمد</div>
                    <div className="text-3xl font-bold text-[#1F3FB0]">خط الرقعة العربي</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {overlay === 'journal' && (
            <div className="mx-auto max-w-3xl pt-8">
              <h2 className="mb-10 text-4xl font-bold text-[#1F3FB0] md:text-5xl">
                مقالات في الورق وخط الرقعة
              </h2>
              <div className="flex flex-col gap-10">
                {JOURNAL_ARTICLES.map((note, idx) => (
                  <article
                    key={idx}
                    className="flex flex-col gap-3 border-b border-[#141414]/15 pb-8"
                  >
                    <span className="text-base text-[#1F3FB0]">{note.date}</span>
                    <h3 className="text-3xl font-bold text-[#141414]">{note.title}</h3>
                    <p className="text-2xl leading-relaxed text-[#6D6A63]">{note.excerpt}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Custom Cursor (pointer: fine) */}
      <div ref={cursorRef} className="cursor" aria-hidden="true">
        <div className="cursor-ring" />
        <div className="cursor-dot" />
        <span className="cursor-label">اقرأ</span>
      </div>
    </>
  );
}
