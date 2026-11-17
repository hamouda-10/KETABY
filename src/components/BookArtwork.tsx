import React from 'react';
import { Book, toArabicDigits } from '../data/books';

export const BookSpine: React.FC<{ book: Book }> = ({ book }) => {
  const { palette } = book;
  const isLightSpine =
    palette.spineBg.toLowerCase() === '#ece5d5' ||
    palette.spineBg.toLowerCase() === '#e6dfd1' ||
    palette.spineBg.toLowerCase() === '#dfd7c6';
  const textColor = isLightSpine ? '#141414' : '#F3F0EA';
  const ruleColor = isLightSpine ? 'rgba(20,20,20,0.35)' : 'rgba(243,240,234,0.35)';

  return (
    <div
      className="book-spine-art"
      style={{
        backgroundColor: palette.spineBg,
        color: textColor,
      }}
    >
      {/* Subtle worn cloth/paper highlight & spine edge crease */}
      <div className="book-spine-sheen" />

      {/* Top raised binding bands */}
      <div className="book-spine-bands" style={{ borderColor: ruleColor }}>
        <span style={{ backgroundColor: palette.accent }} className="book-spine-dot" />
      </div>

      {/* Vertical Ruq'ah book title */}
      <div className="book-spine-title">{book.title}</div>

      {/* Bottom author + year stamp */}
      <div className="book-spine-foot" style={{ borderTopColor: ruleColor }}>
        <span className="book-spine-author">{book.author.split(' ').slice(0, 2).join(' ')}</span>
        <span className="book-spine-year" style={{ borderColor: ruleColor }}>
          {toArabicDigits(book.year)}
        </span>
      </div>
    </div>
  );
};

const MotifIllustration: React.FC<{ motif: Book['palette']['motif']; accent: string; ink: string }> = ({
  motif,
  accent,
  ink,
}) => {
  switch (motif) {
    case 'arch':
      return (
        <svg viewBox="0 0 180 200" className="book-cover-svg" aria-hidden="true">
          <path
            d="M30 185 V85 C30 40 90 16 90 16 C90 16 150 40 150 85 V185 Z"
            fill="none"
            stroke={ink}
            strokeWidth="2.2"
          />
          <path
            d="M48 185 V92 C48 56 90 36 90 36 C90 36 132 56 132 92 V185"
            fill="none"
            stroke={accent}
            strokeWidth="2"
          />
          <circle cx="90" cy="95" r="22" fill={accent} opacity="0.88" />
          <line x1="20" y1="185" x2="160" y2="185" stroke={ink} strokeWidth="2.5" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 180 200" className="book-cover-svg" aria-hidden="true">
          <circle cx="90" cy="100" r="64" fill="none" stroke={ink} strokeWidth="1.8" />
          <rect
            x="45"
            y="55"
            width="90"
            height="90"
            fill="none"
            stroke={accent}
            strokeWidth="2.2"
          />
          <rect
            x="45"
            y="55"
            width="90"
            height="90"
            transform="rotate(45 90 100)"
            fill="none"
            stroke={ink}
            strokeWidth="2"
          />
          <circle cx="90" cy="100" r="14" fill={accent} />
        </svg>
      );
    case 'wave':
      return (
        <svg viewBox="0 0 180 200" className="book-cover-svg" aria-hidden="true">
          <circle cx="90" cy="64" r="28" fill={accent} opacity="0.9" />
          <path
            d="M15 112 Q 52 94 90 112 T 165 112"
            fill="none"
            stroke={ink}
            strokeWidth="2.4"
          />
          <path
            d="M15 134 Q 52 116 90 134 T 165 134"
            fill="none"
            stroke={ink}
            strokeWidth="2.2"
          />
          <path
            d="M15 156 Q 52 138 90 156 T 165 156"
            fill="none"
            stroke={accent}
            strokeWidth="2.2"
          />
          <path
            d="M15 178 Q 52 160 90 178 T 165 178"
            fill="none"
            stroke={ink}
            strokeWidth="1.8"
          />
        </svg>
      );
    case 'botanical':
      return (
        <svg viewBox="0 0 180 200" className="book-cover-svg" aria-hidden="true">
          <line x1="90" y1="184" x2="90" y2="34" stroke={ink} strokeWidth="2.2" />
          <path d="M90 150 C52 146 38 118 44 96 C66 102 84 124 90 150 Z" fill={accent} opacity="0.88" />
          <path d="M90 132 C128 128 142 100 136 78 C114 84 96 106 90 132 Z" fill="none" stroke={ink} strokeWidth="2" />
          <path d="M90 96 C60 92 48 68 54 48 C72 54 86 74 90 96 Z" fill="none" stroke={ink} strokeWidth="2" />
          <circle cx="90" cy="30" r="10" fill={accent} />
        </svg>
      );
    case 'compass':
      return (
        <svg viewBox="0 0 180 200" className="book-cover-svg" aria-hidden="true">
          <circle cx="90" cy="100" r="62" fill="none" stroke={ink} strokeWidth="2" />
          <circle cx="90" cy="100" r="46" fill="none" stroke={accent} strokeWidth="1.4" strokeDasharray="4 4" />
          <polygon points="90,28 102,100 90,172 78,100" fill={accent} opacity="0.88" />
          <polygon points="20,100 90,88 160,100 90,112" fill="none" stroke={ink} strokeWidth="1.8" />
          <circle cx="90" cy="100" r="6" fill={ink} />
        </svg>
      );
    case 'dome':
      return (
        <svg viewBox="0 0 180 200" className="book-cover-svg" aria-hidden="true">
          <path
            d="M36 130 C36 68 90 30 90 30 C90 30 144 68 144 130 Z"
            fill={accent}
            opacity="0.88"
          />
          <rect x="30" y="130" width="120" height="52" fill="none" stroke={ink} strokeWidth="2.2" />
          <line x1="60" y1="130" x2="60" y2="182" stroke={ink} strokeWidth="1.8" />
          <line x1="90" y1="130" x2="90" y2="182" stroke={ink} strokeWidth="1.8" />
          <line x1="120" y1="130" x2="120" y2="182" stroke={ink} strokeWidth="1.8" />
        </svg>
      );
    case 'moon':
      return (
        <svg viewBox="0 0 180 200" className="book-cover-svg" aria-hidden="true">
          <circle cx="90" cy="96" r="56" fill={accent} opacity="0.9" />
          <circle cx="110" cy="88" r="46" fill="currentColor" opacity="0.18" />
          <circle cx="52" cy="48" r="4" fill={ink} />
          <circle cx="136" cy="148" r="5" fill={ink} />
          <line x1="28" y1="176" x2="152" y2="176" stroke={ink} strokeWidth="2" />
        </svg>
      );
    case 'columns':
    default:
      return (
        <svg viewBox="0 0 180 200" className="book-cover-svg" aria-hidden="true">
          <line x1="26" y1="36" x2="154" y2="36" stroke={ink} strokeWidth="2.6" />
          <line x1="26" y1="178" x2="154" y2="178" stroke={ink} strokeWidth="2.6" />
          <rect x="40" y="46" width="18" height="122" fill="none" stroke={ink} strokeWidth="1.8" />
          <rect x="81" y="46" width="18" height="122" fill={accent} opacity="0.88" />
          <rect x="122" y="46" width="18" height="122" fill="none" stroke={ink} strokeWidth="1.8" />
        </svg>
      );
  }
};

export const BookCover: React.FC<{ book: Book }> = ({ book }) => {
  const { palette } = book;
  return (
    <div
      className="book-cover-art"
      style={{
        backgroundColor: palette.coverBg,
        color: palette.ink,
      }}
    >
      {/* Worn paper / cloth framing border */}
      <div className="book-cover-frame" style={{ borderColor: palette.ink }}>
        <div className="book-cover-top">
          <span className="book-cover-author">{book.author}</span>
          <span className="book-cover-rule" style={{ backgroundColor: palette.accent }} />
        </div>

        <h3 className="book-cover-title">{book.title}</h3>

        <div className="book-cover-illu">
          <MotifIllustration
            motif={palette.motif}
            accent={palette.accent}
            ink={palette.ink}
          />
        </div>

        <div className="book-cover-bottom">
          <span className="book-cover-sub">{book.subtitle}</span>
          <span className="book-cover-badge" style={{ borderColor: palette.ink }}>
            {book.genre} · {toArabicDigits(book.year)}
          </span>
        </div>
      </div>
    </div>
  );
};
