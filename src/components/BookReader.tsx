import React, { useEffect, useRef, useState } from 'react';
import { Book, BookPage, toArabicDigits } from '../data/books';

interface BookReaderProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  readerRef: React.RefObject<HTMLElement | null>;
}

const PageContent: React.FC<{
  page: BookPage;
  bookTitle: string;
  author: string;
  accent: string;
  fontSize: number;
  side: 'right' | 'left';
}> = ({ page, bookTitle, author, accent, fontSize, side }) => {
  return (
    <div className={`book-page-inner book-page-${side}`}>
      <div className="book-page-header">
        <span>{side === 'right' ? bookTitle : author}</span>
        {page.chapter && <span style={{ color: accent }}>{page.chapter}</span>}
      </div>

      <div className="book-page-body" style={{ fontSize: `${fontSize}px` }}>
        {page.heading && (
          <h2 className="book-page-heading" style={{ color: accent }}>
            {page.heading}
          </h2>
        )}

        {page.paragraphs.map((para, idx) => (
          <p key={idx} className="book-page-para">
            {para}
          </p>
        ))}

        {page.quote && (
          <blockquote className="book-page-quote" style={{ borderColor: accent }}>
            {page.quote}
          </blockquote>
        )}
      </div>

      <div className="book-page-footer">
        <span className="book-page-num">{toArabicDigits(page.pageNumber)}</span>
      </div>
    </div>
  );
};

export const BookReader: React.FC<BookReaderProps> = ({
  book,
  isOpen,
  onClose,
  readerRef,
}) => {
  const [spread, setSpread] = useState<number>(0);
  const [mobilePage, setMobilePage] = useState<number>(0);
  const [flippingLeaf, setFlippingLeaf] = useState<number | null>(null);
  const [fontSize, setFontSize] = useState<number>(23);
  const [showToc, setShowToc] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth <= 767 : false
  );

  const flipTimerRef = useRef<number | null>(null);
  const dragStartRef = useRef<number | null>(null);

  const totalSpreads = Math.ceil(book.pages.length / 2); // 4 spreads for 8 pages
  const totalLeaves = totalSpreads - 1; // 3 flipping leaves

  // Reset to first spread whenever a new book opens
  useEffect(() => {
    if (isOpen) {
      setSpread(0);
      setMobilePage(0);
      setFlippingLeaf(null);
      setShowToc(false);
    }
  }, [isOpen, book.id]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 767);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const triggerFlip = (nextSpread: number) => {
    const clamped = Math.max(0, Math.min(totalSpreads - 1, nextSpread));
    if (clamped === spread) return;

    const leaf = clamped > spread ? spread : clamped;
    setFlippingLeaf(leaf);
    setSpread(clamped);

    if (flipTimerRef.current !== null) window.clearTimeout(flipTimerRef.current);
    flipTimerRef.current = window.setTimeout(() => {
      setFlippingLeaf(null);
    }, 850);
  };

  const nextStep = () => {
    if (isMobile) {
      setMobilePage((p) => Math.min(book.pages.length - 1, p + 1));
    } else {
      triggerFlip(spread + 1);
    }
  };

  const prevStep = () => {
    if (isMobile) {
      setMobilePage((p) => Math.max(0, p - 1));
    } else {
      triggerFlip(spread - 1);
    }
  };

  // Keyboard navigation inside open book (RTL: Left arrow = forward/next page, Right arrow = back/prev page)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        prevStep();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, spread, mobilePage, isMobile, book.id]);

  const handleBookPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragStartRef.current = e.clientX;
  };

  const handleBookPointerUp = (e: React.PointerEvent) => {
    if (dragStartRef.current === null) return;
    const dx = e.clientX - dragStartRef.current;
    dragStartRef.current = null;
    if (Math.abs(dx) > 45) {
      // Swipe left-to-right (dx > 0) turns page forward in Arabic RTL book!
      if (dx > 0) nextStep();
      else prevStep();
    }
  };

  const currentLeftNum = isMobile ? mobilePage + 1 : spread * 2 + 2;
  const currentRightNum = isMobile ? mobilePage + 1 : spread * 2 + 1;

  return (
    <section
      ref={readerRef as React.RefObject<HTMLElement>}
      className={`reader-sheet ${isOpen ? 'is-open' : ''}`}
      aria-hidden={!isOpen}
      aria-label={`قراءة كتاب ${book.title}`}
    >
      {/* Reader Top Bar */}
      <div className="reader-topbar">
        <div className="reader-top-actions">
          <button type="button" className="box" onClick={onClose}>
            إغلاق الكتاب
          </button>

          <button
            type="button"
            className="box"
            onClick={() => setShowToc((s) => !s)}
          >
            الفهرس
          </button>

          <div className="reader-font-controls" aria-label="حجم خط القراءة">
            <button
              type="button"
              className="reader-font-btn"
              onClick={() => setFontSize((f) => Math.max(18, f - 2))}
              aria-label="تصغير الخط"
            >
              أ-
            </button>
            <span className="reader-font-val">{toArabicDigits(fontSize)}</span>
            <button
              type="button"
              className="reader-font-btn"
              onClick={() => setFontSize((f) => Math.min(30, f + 2))}
              aria-label="تكبير الخط"
            >
              أ+
            </button>
          </div>
        </div>

        <div className="reader-book-badge">
          <span className="reader-book-name">{book.title}</span>
          <span className="brand-rule" aria-hidden="true" />
          <span className="reader-book-author">{book.author}</span>
        </div>
      </div>

      {/* Table of Contents Popover */}
      {showToc && (
        <div className="reader-toc-panel" role="dialog" aria-label="فهرس الكتاب">
          <div className="reader-toc-head">
            <span>فصول كتاب «{book.title}»</span>
            <button type="button" onClick={() => setShowToc(false)}>
              إخفاء
            </button>
          </div>
          <p className="reader-toc-note">{book.editionNote}</p>
          <div className="reader-toc-list">
            {book.pages.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className="reader-toc-item"
                onClick={() => {
                  if (isMobile) setMobilePage(idx);
                  else triggerFlip(Math.floor(idx / 2));
                  setShowToc(false);
                }}
              >
                <span>
                  {p.chapter ? `${p.chapter} — ` : ''}
                  {p.heading || `صفحة ${toArabicDigits(p.pageNumber)}`}
                </span>
                <span>ص {toArabicDigits(p.pageNumber)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Real 3D Two-Page Open Book Desk */}
      <div
        className="reader-desk"
        onPointerDown={handleBookPointerDown}
        onPointerUp={handleBookPointerUp}
      >
        {!isMobile ? (
          <div className="open-book-wrap">
            {/* Hardcover binding backing board */}
            <div
              className="open-book-board"
              style={{ backgroundColor: book.palette.spineBg }}
            />

            {/* Stacked paper edges thickness illusion */}
            <div className="open-book-paper-stack" />

            {/* 3D Two-page scene (always LTR coordinates internally for exact geometric hinge math) */}
            <div className="open-book-scene">
              {/* Base Right Page (Page 1) */}
              <div
                className="book-static-page book-static-right"
                onClick={prevStep}
                title={spread > 0 ? 'اضغط للعودة للصفحة السابقة' : undefined}
              >
                <PageContent
                  page={book.pages[0]}
                  bookTitle={book.title}
                  author={book.author}
                  accent={book.palette.accent}
                  fontSize={fontSize}
                  side="right"
                />
                <div className="book-gutter-shadow-right" />
              </div>

              {/* Base Left Page (Final Page) */}
              <div
                className="book-static-page book-static-left"
                onClick={nextStep}
                title={spread < totalSpreads - 1 ? 'اضغط لتقليب الصفحة التالية' : undefined}
              >
                <PageContent
                  page={book.pages[book.pages.length - 1]}
                  bookTitle={book.title}
                  author={book.author}
                  accent={book.palette.accent}
                  fontSize={fontSize}
                  side="left"
                />
                <div className="book-gutter-shadow-left" />
              </div>

              {/* Dynamic Turning 3D Leaves */}
              {Array.from({ length: totalLeaves }, (_, i) => {
                const isFlipped = i < spread;
                const frontPage = book.pages[i * 2 + 1]; // Left side before flip (2, 4, 6)
                const backPage = book.pages[(i + 1) * 2]; // Right side after flip (3, 5, 7)

                let zIdx = 0;
                if (flippingLeaf === i) {
                  zIdx = 100;
                } else if (isFlipped) {
                  zIdx = 10 + i;
                } else {
                  zIdx = 40 - i;
                }

                return (
                  <div
                    key={i}
                    className={`book-leaf ${isFlipped ? 'is-flipped' : ''}`}
                    style={{ zIndex: zIdx }}
                  >
                    {/* Front Face (Left page when unflipped) */}
                    <div
                      className="book-leaf-face book-leaf-front"
                      onClick={() => triggerFlip(spread + 1)}
                      title="اضغط لتقليب الصفحة"
                    >
                      <PageContent
                        page={frontPage}
                        bookTitle={book.title}
                        author={book.author}
                        accent={book.palette.accent}
                        fontSize={fontSize}
                        side="left"
                      />
                      <div className="book-gutter-shadow-left" />
                      <div className="book-corner-curl-left" />
                    </div>

                    {/* Back Face (Right page when flipped) */}
                    <div
                      className="book-leaf-face book-leaf-back"
                      onClick={() => triggerFlip(spread - 1)}
                      title="اضغط للرجوع للصفحة السابقة"
                    >
                      <PageContent
                        page={backPage}
                        bookTitle={book.title}
                        author={book.author}
                        accent={book.palette.accent}
                        fontSize={fontSize}
                        side="right"
                      />
                      <div className="book-gutter-shadow-right" />
                      <div className="book-corner-curl-right" />
                    </div>
                  </div>
                );
              })}

              {/* Central stitched binding crease */}
              <div className="book-center-spine" aria-hidden="true" />
            </div>
          </div>
        ) : (
          /* Mobile single-page crisp reader with animated page swap */
          <div className="mobile-book-wrap">
            <div className="mobile-book-card">
              <PageContent
                page={book.pages[mobilePage]}
                bookTitle={book.title}
                author={book.author}
                accent={book.palette.accent}
                fontSize={Math.max(19, fontSize - 2)}
                side="right"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Page-Turning Bar */}
      <div className="reader-bottom-bar">
        <button
          type="button"
          className="box-cobalt reader-nav-btn"
          disabled={isMobile ? mobilePage === 0 : spread === 0}
          onClick={prevStep}
        >
          → الصفحة السابقة
        </button>

        <div className="reader-progress-text">
          {isMobile
            ? `صفحة ${toArabicDigits(currentRightNum)} من ${toArabicDigits(book.pages.length)}`
            : `الصفحتان ${toArabicDigits(currentRightNum)} — ${toArabicDigits(
                currentLeftNum
              )} من ${toArabicDigits(book.pages.length)}`}
        </div>

        <button
          type="button"
          className="box-cobalt reader-nav-btn"
          disabled={isMobile ? mobilePage === book.pages.length - 1 : spread === totalSpreads - 1}
          onClick={nextStep}
        >
          الصفحة التالية ←
        </button>
      </div>
    </section>
  );
};
