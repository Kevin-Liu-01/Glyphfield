import type { CSSProperties } from 'react';

type BrandOpenGraphImageProps = {
  accent: string;
  description: string;
  highlightedTitle?: string;
  title: string;
  url?: string;
};

const DITHERED_SWIRL_SIZE = 6;
const DITHERED_SWIRL_WIDTH = 480;
const DITHERED_SWIRL_HEIGHT = 630;
const BAYER_8X8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
] as const;
const OPEN_GRAPH_SHELL_STYLE: CSSProperties = {
  background: '#f4f3ef',
  color: '#111113',
  display: 'flex',
  fontFamily: 'Switzer, Arial, sans-serif',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
  width: '100%',
};

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return normalized * normalized * (3 - 2 * normalized);
}

function buildDitheredSwirlPath(): string {
  const cells: string[] = [];
  const columns = Math.ceil(DITHERED_SWIRL_WIDTH / DITHERED_SWIRL_SIZE);
  const rows = Math.ceil(DITHERED_SWIRL_HEIGHT / DITHERED_SWIRL_SIZE);
  const time = 0.8;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const pixelX = column * DITHERED_SWIRL_SIZE + DITHERED_SWIRL_SIZE / 2;
      const pixelY = row * DITHERED_SWIRL_SIZE + DITHERED_SWIRL_SIZE / 2;
      const x = (pixelX - DITHERED_SWIRL_WIDTH / 2) / DITHERED_SWIRL_HEIGHT;
      const y = (pixelY - DITHERED_SWIRL_HEIGHT / 2) / DITHERED_SWIRL_HEIGHT;
      const length = Math.max(0.000001, Math.hypot(x, y));
      const twist = 1.2;
      const angle = 6 * Math.atan2(y, x) + 4 * time;
      const offset = 1 / Math.pow(length, twist) + angle / (Math.PI * 2);
      const middle = smoothstep(0, 1, Math.pow(length, twist));
      const shape = (offset - Math.floor(offset)) * middle;
      const threshold = BAYER_8X8[(row % 8) * 8 + (column % 8)]! / 64;

      if (shape + threshold < 1) continue;
      const cellX = column * DITHERED_SWIRL_SIZE;
      const cellY = row * DITHERED_SWIRL_SIZE;
      cells.push(`M${cellX} ${cellY}h${DITHERED_SWIRL_SIZE}v${DITHERED_SWIRL_SIZE}h-${DITHERED_SWIRL_SIZE}Z`);
    }
  }

  return cells.join('');
}

const DITHERED_SWIRL_PATH = buildDitheredSwirlPath();

function GlyphfieldMark({ color = '#ffffff', size = 52 }: { color?: string; size?: number }) {
  return (
    <svg height={size} viewBox='0 0 64 64' width={size}>
      <path d='M6 6H56V16H16V48H48V58H6V6Z' fill={color} />
      <path d='M46 16H56V26H46V16Z' fill={color} />
      <path d='M28 27H46L41 32H58L40 45L45 37H27L32 32H22L28 27Z' fill={color} />
    </svg>
  );
}

function GlyphField({ accent }: { accent: string }) {
  return (
    <div
      style={{
        alignItems: 'flex-end',
        background: '#201046',
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <svg
        aria-hidden='true'
        data-og-shader='paper-dithering-swirl'
        height={DITHERED_SWIRL_HEIGHT}
        preserveAspectRatio='xMidYMid slice'
        viewBox={`0 0 ${DITHERED_SWIRL_WIDTH} ${DITHERED_SWIRL_HEIGHT}`}
        width={DITHERED_SWIRL_WIDTH}
      >
        <rect fill='#201046' height={DITHERED_SWIRL_HEIGHT} width={DITHERED_SWIRL_WIDTH} />
        <path d={DITHERED_SWIRL_PATH} fill='#C8C0FF' />
      </svg>
      <div
        style={{
          background: `linear-gradient(180deg, rgba(123,255,217,0.16) 0%, ${accent}00 38%, ${accent}52 100%)`,
          display: 'flex',
          inset: 0,
          position: 'absolute',
        }}
      />
      <div
        style={{
          alignItems: 'center',
          border: '1px solid rgba(255,255,255,0.42)',
          display: 'flex',
          height: 146,
          justifyContent: 'center',
          left: 167,
          position: 'absolute',
          top: 242,
          width: 146,
        }}
      >
        <GlyphfieldMark size={78} />
      </div>
    </div>
  );
}

export default function BrandOpenGraphImage({
  accent,
  description,
  highlightedTitle,
  title,
  url = 'glyphfield.com',
}: BrandOpenGraphImageProps) {
  const titleSize = title.length > 58 ? 55 : title.length > 38 ? 63 : 72;
  const highlightedTitleIndex = highlightedTitle ? title.indexOf(highlightedTitle) : -1;
  const titleBeforeHighlight = highlightedTitleIndex > 0
    ? title.slice(0, highlightedTitleIndex).trimEnd()
    : '';
  const titleFromHighlight = highlightedTitleIndex >= 0
    ? title.slice(highlightedTitleIndex)
    : '';
  return (
    <div style={OPEN_GRAPH_SHELL_STYLE}>
      <div
        style={{
          borderRight: '1px solid rgba(17,17,19,0.2)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '34px 44px 30px',
          position: 'relative',
          width: 720,
        }}
        data-og-panel='copy'
      >
        <div style={{ alignItems: 'center', display: 'flex', height: 48 }}>
          <GlyphfieldMark color='#111113' size={40} />
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              fontWeight: 550,
              letterSpacing: -0.45,
              marginLeft: 14,
            }}
          >
            Glyphfield
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: highlightedTitleIndex >= 0 ? 'column' : 'row',
            fontSize: titleSize,
            fontWeight: 500,
            letterSpacing: -3.4,
            lineHeight: 0.98,
            marginTop: 90,
            maxWidth: 650,
          }}
        >
          {highlightedTitleIndex >= 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {titleBeforeHighlight ? <div style={{ display: 'flex' }}>{titleBeforeHighlight}</div> : null}
              <div style={{ color: accent, display: 'flex' }}>{titleFromHighlight}</div>
            </div>
          ) : title}
        </div>
        <div
          style={{
            color: 'rgba(17,17,19,0.62)',
            display: 'flex',
            fontSize: 22,
            letterSpacing: -0.35,
            lineHeight: 1.35,
            marginTop: 24,
            maxWidth: 624,
          }}
        >
          {description}
        </div>

        <div
          style={{
            alignItems: 'center',
            background: '#111113',
            color: '#ffffff',
            display: 'flex',
            fontSize: 21,
            fontWeight: 550,
            height: 68,
            justifyContent: 'space-between',
            letterSpacing: -0.25,
            marginTop: 'auto',
            padding: '0 24px',
            width: 330,
          }}
        >
          <span style={{ display: 'flex' }}>{url}</span>
          <span style={{ color: accent, display: 'flex', fontSize: 29, lineHeight: 1 }}>→</span>
        </div>
      </div>

      <div data-og-panel='image' style={{ display: 'flex', height: '100%', width: 480 }}>
        <GlyphField accent={accent} />
      </div>
    </div>
  );
}
