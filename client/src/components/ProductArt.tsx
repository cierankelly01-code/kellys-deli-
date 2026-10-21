import { useId } from "react";

/* Engraved product art for the Christmas range — shown wherever a product has no photo
 * yet. Drawn as single-ink line work with hatched shading inside a fine oval frame, in
 * the manner of a heritage grocer's label, so the menu reads considered rather than
 * empty. Plainly illustrations — never passed off as photos of the food. */

type Kind = "ham" | "joint" | "sliced" | "turkey" | "pie" | "mincePies" | "sausages" | "stuffing" | "cheese" | "hamper" | "platter" | "gift";

const INK = "#16352c";
const GOLD = "#a98a4f";
const BERRY = "#7d1d2c";
const PAPER = "#fbf7ef";
const GROUND = "#f3ecdf";

/** Pick the drawing from the product's name, falling back to its section — so "Pigs in
 * Blankets" in "Turkey & Trimmings" draws sausages, not a turkey. */
export function artKind(name: string, section?: string | null): Kind {
  return kindFor(name.toLowerCase()) ?? kindFor((section ?? "").toLowerCase()) ?? "gift";
}

function kindFor(n: string): Kind | null {
  if (!n) return null;
  if (/hamper|gift/.test(n)) return "hamper";
  if (/sliced|counter/.test(n)) return "sliced";
  if (/wiltshire|gammon|joint/.test(n)) return "joint";
  if (/ham\b/.test(n)) return "ham";
  if (/turkey/.test(n)) return "turkey";
  if (/mince/.test(n)) return "mincePies";
  if (/pork pie|pie/.test(n)) return "pie";
  if (/stuffing/.test(n)) return "stuffing";
  if (/blanket|sausage|chipolata|trimming/.test(n)) return "sausages";
  if (/cheese|stilton|brie|cheddar/.test(n)) return "cheese";
  if (/platter|board|grazing|party/.test(n)) return "platter";
  return null;
}

/** Parallel hatching clipped to a shape — the engraver's way of shading. */
function Hatch({ uid, id, d, x0 = 40, x1 = 360, y0 = 40, y1 = 270, gap = 5, slant = 0.35, opacity = 0.55 }: {
  uid: string; id: string; d: string; x0?: number; x1?: number; y0?: number; y1?: number; gap?: number; slant?: number; opacity?: number;
}) {
  const lines = [];
  const h = y1 - y0;
  for (let x = x0 - h * slant; x < x1; x += gap) lines.push(<line key={x} x1={x} y1={y1} x2={x + h * slant} y2={y0} />);
  return (
    <g>
      <defs><clipPath id={`${uid}-${id}`}><path d={d} /></clipPath></defs>
      <g clipPath={`url(#${uid}-${id})`} stroke={INK} strokeWidth="0.9" opacity={opacity}>{lines}</g>
    </g>
  );
}

const line = { fill: "none", stroke: INK, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Board({ cy = 214, rx = 128 }: { cy?: number; rx?: number }) {
  return (
    <g {...line}>
      <path d={`M${200 - rx} ${cy} v7 a${rx} 24 0 0 0 ${rx * 2} 0 v-7`} fill={PAPER} />
      <ellipse cx="200" cy={cy} rx={rx} ry="24" fill={PAPER} />
      <path d={`M${200 - rx + 30} ${cy - 6} q60 -8 120 -4 M${200 - rx + 60} ${cy + 8} q70 -6 150 0`} strokeWidth="0.9" opacity=".5" />
    </g>
  );
}

function Holly({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <g {...line} strokeWidth={1.6} fill={PAPER}>
        <path d="M0 0 C 8 -14, 26 -16, 40 -10 C 34 -6, 36 0, 30 2 C 26 -2, 20 2, 16 -2 C 12 4, 6 2, 0 0 Z" />
        <path d="M0 0 C 2 16, 16 26, 32 28 C 28 22, 32 18, 28 14 C 22 16, 20 10, 16 12 C 14 6, 6 6, 0 0 Z" />
        <path d="M2 -1 Q 20 -6 36 -9 M2 2 Q 14 14 30 25" strokeWidth={0.9} />
      </g>
      <circle cx="-3" cy="-4" r="5" fill={BERRY} />
      <circle cx="6" cy="-9" r="4.4" fill={BERRY} />
      <circle cx="3" cy="4" r="4.4" fill={BERRY} />
    </g>
  );
}

function Ham({ uid }: { uid: string }) {
  const body = "M122 192 C 110 132, 192 90, 264 110 C 318 126, 322 186, 282 202 C 236 220, 140 220, 122 192 Z";
  return (
    <g>
      <Board />
      <path d={body} fill={PAPER} />
      <defs><clipPath id={`${uid}-hamclip`}><path d={body} /></clipPath></defs>
      <g clipPath={`url(#${uid}-hamclip)`} stroke={INK} strokeWidth="1.1" opacity=".75">
        {Array.from({ length: 13 }, (_, i) => <line key={`a${i}`} x1={70 + i * 24} y1="70" x2={-20 + i * 24} y2="230" />)}
        {Array.from({ length: 13 }, (_, i) => <line key={`b${i}`} x1={70 + i * 24} y1="230" x2={-20 + i * 24} y2="70" />)}
      </g>
      <Hatch uid={uid} id="hamshade" d="M200 214 C 250 214, 300 204, 312 178 C 320 196, 300 210, 270 214 Z M122 192 C 140 214, 200 220, 230 216 L 200 222 C 150 222, 126 210, 122 192 Z" gap={4} opacity={0.6} />
      <g fill={INK}>
        {Array.from({ length: 28 }, (_, i) => {
          const col = i % 7;
          const row = Math.floor(i / 7);
          return <circle key={i} cx={150 + col * 24 + (row % 2) * 12} cy={122 + row * 22} r="1.9" />;
        })}
      </g>
      <path d={body} {...line} strokeWidth={2.4} />
      <g {...line} fill={PAPER}>
        <path d="M88 188 L 126 176 L 130 190 L 92 202 Z" />
        <circle cx="86" cy="200" r="10" />
        <circle cx="82" cy="188" r="8.5" />
      </g>
      <Holly x={292} y={208} s={0.85} />
    </g>
  );
}

/** A cured joint, tied with butcher's string — the Wiltshire ham and gammon. */
function Joint({ uid }: { uid: string }) {
  const body = "M110 186 C 104 140, 150 112, 200 112 C 252 112, 300 138, 294 186 C 290 210, 120 212, 110 186 Z";
  return (
    <g>
      <Board />
      <path d={body} fill={PAPER} />
      <Hatch uid={uid} id="jt" d="M240 116 C 276 124, 298 150, 294 186 C 292 200, 262 206, 240 208 C 256 176, 256 140, 240 116 Z" gap={4} slant={0.08} />
      <Hatch uid={uid} id="jt2" d="M110 186 C 108 170, 112 158, 118 150 C 120 170, 126 188, 136 200 C 122 198, 112 194, 110 186 Z" gap={4} slant={0.08} opacity={0.4} />
      <path d={body} {...line} strokeWidth={2.4} />
      {/* Fat cap and the cut face at the end. */}
      <path d="M128 150 C 160 126, 240 122, 282 150" {...line} strokeWidth={1.2} opacity=".6" />
      <ellipse cx="292" cy="170" rx="9" ry="30" {...line} strokeWidth={1.6} fill={PAPER} />
      <ellipse cx="292" cy="170" rx="4" ry="16" {...line} strokeWidth={1} />
      {/* Butcher's string. */}
      <g {...line} stroke="#7c6330" strokeWidth={1.6}>
        {[146, 178, 212, 246].map((x) => <path key={x} d={`M${x} ${114 + Math.abs(200 - x) * 0.08} C ${x - 10} 150, ${x - 10} 180, ${x} 206`} />)}
        <path d="M120 168 C 170 160, 240 160, 286 168" />
      </g>
      <Holly x={86} y={210} s={0.8} flip />
    </g>
  );
}

/** Ham sliced from the counter, fanned on a board, carving knife alongside. */
function Sliced({ uid }: { uid: string }) {
  const slice = (i: number) => {
    const x = 128 + i * 36;
    const y = 196 - i * 6;
    return (
      <g key={i} transform={`rotate(${-16 + i * 6} ${x} ${y})`}>
        <path d={`M${x - 46} ${y} C ${x - 40} ${y - 46}, ${x + 40} ${y - 52}, ${x + 48} ${y - 8} C ${x + 40} ${y + 16}, ${x - 38} ${y + 18}, ${x - 46} ${y} Z`} fill={PAPER} {...line} strokeWidth={2} />
        <path d={`M${x - 40} ${y - 6} C ${x - 32} ${y - 38}, ${x + 34} ${y - 44}, ${x + 42} ${y - 12}`} {...line} strokeWidth={1} opacity=".6" />
        <Hatch uid={uid} id={`sl${i}`} d={`M${x + 10} ${y + 12} C ${x + 30} ${y + 8}, ${x + 46} ${y}, ${x + 48} ${y - 8} C ${x + 44} ${y + 10}, ${x + 30} ${y + 16}, ${x + 10} ${y + 16} Z`} x0={x - 60} x1={x + 60} y0={y - 60} y1={y + 30} gap={3} opacity={0.5} />
      </g>
    );
  };
  return (
    <g>
      <Board />
      {[0, 1, 2, 3, 4].map(slice)}
      <g {...line} strokeWidth={1.6} fill={PAPER}>
        <path d="M236 226 L 318 206 L 322 212 L 240 230 Z" />
        <rect x="318" y="201" width="34" height="11" rx="4" transform="rotate(-14 335 206)" />
      </g>
    </g>
  );
}

function Turkey({ uid }: { uid: string }) {
  const dome = "M106 206 C 102 128, 160 92, 200 92 C 240 92, 298 128, 294 206 Z";
  return (
    <g>
      <Board />
      <path d={dome} fill={PAPER} />
      <Hatch uid={uid} id="tk" d="M232 96 C 270 112, 300 150, 294 206 L 240 206 C 254 160, 250 120, 232 96 Z" gap={4.2} slant={0.1} />
      <Hatch uid={uid} id="tk2" d="M106 206 C 104 186, 108 168, 114 156 C 116 176, 120 194, 130 206 Z" gap={4} slant={0.1} opacity={0.4} />
      <path d={dome} {...line} strokeWidth={2.4} />
      <g {...line} strokeWidth={1.3}>
        <path d="M200 94 C 196 140, 196 178, 200 206" />
        <path d="M150 112 C 160 150, 162 180, 160 206 M250 112 C 240 150, 238 180, 240 206" opacity=".7" />
        <path d="M140 130 C 166 118, 180 112, 196 110" strokeWidth={0.9} opacity=".5" />
      </g>
      <g {...line} strokeWidth={1.5}>
        <path d="M288 218 L 340 192" />
        {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${294 + i * 6.5} ${215 - i * 3.2} l ${i % 2 ? 7 : -5} ${i % 2 ? -10 : -12}`} />)}
      </g>
      <circle cx="98" cy="220" r="5" fill={BERRY} />
      <circle cx="109" cy="227" r="4.4" fill={BERRY} />
    </g>
  );
}

function Pie({ uid }: { uid: string }) {
  const side = "M128 128 L 128 196 Q 200 220, 272 196 L 272 128 Z";
  return (
    <g>
      <Board />
      <path d={side} fill={PAPER} />
      <Hatch uid={uid} id="pie" d="M226 140 L 272 128 L 272 196 Q 250 204, 226 208 Z" gap={4} slant={0.05} />
      <g {...line}>
        <path d="M128 128 L 128 196 Q 200 220, 272 196 L 272 128" strokeWidth={2.4} />
        <ellipse cx="200" cy="128" rx="72" ry="21" fill={PAPER} strokeWidth={2.4} />
      </g>
      <g {...line} strokeWidth={1.4} fill={PAPER}>
        {Array.from({ length: 20 }, (_, i) => {
          const a = (i / 20) * Math.PI * 2;
          return <circle key={i} cx={200 + Math.cos(a) * 68} cy={128 + Math.sin(a) * 19.5} r="5" />;
        })}
      </g>
      <ellipse cx="200" cy="127" rx="10" ry="4" {...line} strokeWidth={1.6} />
      <path d="M178 118 l -14 -5 M222 118 l 14 -5" {...line} strokeWidth={1.4} />
      <Holly x={86} y={210} s={0.8} flip />
    </g>
  );
}

function MincePies({ uid }: { uid: string }) {
  const pie = (x: number, y: number, k: string) => (
    <g key={k} transform={`translate(${x} ${y})`}>
      <path d="M-42 0 L -36 17 Q 0 26, 36 17 L 42 0" fill={PAPER} {...line} strokeWidth={2} />
      <Hatch uid={uid} id={`mp${k}`} d="M10 4 L 42 0 L 36 17 Q 24 21, 10 22 Z" x0={-60} x1={60} y0={-20} y1={30} gap={3.6} slant={0.05} />
      <ellipse cx="0" cy="0" rx="42" ry="12" fill={PAPER} {...line} strokeWidth={2} />
      <path d="M0 -9 L 3.6 -2 L 12 -2 L 5.5 2.6 L 8 10 L 0 5.6 L -8 10 L -5.5 2.6 L -12 -2 L -3.6 -2 Z" fill={PAPER} {...line} strokeWidth={1.3} />
    </g>
  );
  return (
    <g transform="translate(200 190) scale(1.28) translate(-200 -186)">
      <g {...line}>
        <ellipse cx="200" cy="214" rx="138" ry="26" fill={PAPER} />
        <ellipse cx="200" cy="212" rx="112" ry="17" strokeWidth={0.9} opacity=".55" />
      </g>
      {pie(144, 190, "a")}
      {pie(256, 190, "b")}
      {pie(200, 160, "c")}
      <g fill={GOLD}>{[[122, 120], [292, 112], [214, 96], [166, 102]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" />)}</g>
    </g>
  );
}

function Sausages({ uid }: { uid: string }) {
  const banger = (x: number, y: number, r: number, k: string) => (
    <g key={k} transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-40" y="-11" width="80" height="22" rx="11" fill={PAPER} {...line} strokeWidth={1.9} />
      <Hatch uid={uid} id={`bl${k}`} d="M-24 -12 C -18 0, -18 6, -24 12 L -10 12 C -4 6, -4 0, -10 -12 Z M2 -12 C 8 0, 8 6, 2 12 L 16 12 C 22 6, 22 0, 16 -12 Z" x0={-60} x1={60} y0={-20} y1={20} gap={3} slant={0.6} opacity={0.75} />
      <path d="M-24 -12 C -18 0, -18 6, -24 12 M-10 -12 C -4 0, -4 6, -10 12 M2 -12 C 8 0, 8 6, 2 12 M16 -12 C 22 0, 22 6, 16 12" {...line} strokeWidth={1.2} />
    </g>
  );
  return (
    <g>
      <g {...line}>
        <ellipse cx="200" cy="216" rx="146" ry="30" fill={PAPER} />
        <ellipse cx="200" cy="214" rx="118" ry="20" strokeWidth={0.9} opacity=".55" />
      </g>
      {banger(146, 212, -10, "a")}
      {banger(254, 214, 8, "b")}
      {banger(200, 198, -3, "c")}
      {banger(150, 182, 12, "d")}
      {banger(250, 182, -10, "e")}
    </g>
  );
}

function Stuffing({ uid }: { uid: string }) {
  const balls = [[140, 196], [180, 204], [222, 204], [262, 196], [160, 172], [202, 178], [244, 172], [202, 150]];
  return (
    <g>
      <g {...line}>
        <ellipse cx="200" cy="216" rx="140" ry="28" fill={PAPER} />
        <ellipse cx="200" cy="214" rx="112" ry="18" strokeWidth={0.9} opacity=".55" />
      </g>
      {balls.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="22" fill={PAPER} />
          <Hatch uid={uid} id={`st${i}`} d={`M${x + 4} ${y - 21} A 22 22 0 0 1 ${x + 4} ${y + 21} A 16 22 0 0 0 ${x + 4} ${y - 21} Z`} x0={x - 30} x1={x + 30} y0={y - 26} y1={y + 26} gap={3.4} slant={0.2} />
          <circle cx={x} cy={y} r="22" {...line} strokeWidth={1.9} />
          {[[-8, 2], [5, -6], [2, 9], [-10, -8]].map(([dx, dy]) => <circle key={`${dx}${dy}`} cx={x + dx} cy={y + dy} r="1.6" fill={INK} />)}
        </g>
      ))}
      <path d="M300 214 c 14 -10, 26 -10, 38 -4 M304 222 c 12 4, 24 2, 32 -6" {...line} strokeWidth={1.4} />
    </g>
  );
}

function Cheese({ uid }: { uid: string }) {
  return (
    <g>
      <Board />
      <path d="M96 124 L 96 198 Q 151 214, 206 198 L 206 124 Z" fill={PAPER} />
      <Hatch uid={uid} id="stil" d="M166 132 L 206 124 L 206 198 Q 186 205, 166 207 Z" gap={4} slant={0.05} />
      <g {...line} strokeWidth={2.2}>
        <path d="M96 124 L 96 198 Q 151 214, 206 198 L 206 124" />
        <ellipse cx="151" cy="124" rx="55" ry="15" fill={PAPER} />
      </g>
      <g {...line} strokeWidth={1.2} opacity=".8">
        <path d="M106 150 c 10 -6, 16 8, 26 0 s 14 6, 22 -2" />
        <path d="M112 172 c 8 6, 18 -6, 30 2 s 18 -4, 26 4" />
        <path d="M118 190 c 10 -4, 16 6, 28 -2" />
      </g>
      <path d="M214 206 L 318 206 L 318 152 Z" fill={PAPER} {...line} strokeWidth={2.2} />
      <path d="M214 206 L 318 152 L 300 140 Z" fill={PAPER} {...line} strokeWidth={2.2} />
      <Hatch uid={uid} id="wedge" d="M318 152 L 318 206 L 332 196 L 332 144 Z" gap={3.4} slant={0.05} opacity={0.7} />
      <path d="M318 152 L 318 206 L 332 196 L 332 144 Z" {...line} strokeWidth={2} />
      {[[266, 192, 6], [294, 180, 4.5], [248, 199, 3.5]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} {...line} strokeWidth={1.4} />)}
      <g {...line} strokeWidth={1.6} fill={PAPER}>
        {[[236, 224], [250, 228], [243, 216], [257, 220]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="6.5" />)}
      </g>
    </g>
  );
}

function Hamper({ uid }: { uid: string }) {
  const basket = "M98 124 L 302 124 L 284 226 L 116 226 Z";
  return (
    <g>
      <path d="M122 124 C 122 56, 278 56, 278 124" {...line} strokeWidth={6} />
      <path d="M122 124 C 122 56, 278 56, 278 124" {...line} strokeWidth={3} stroke={PAPER} />
      <g {...line} fill={PAPER} strokeWidth={1.8}>
        <rect x="226" y="72" width="18" height="60" rx="4" />
        <rect x="229" y="60" width="12" height="14" rx="2" />
        <rect x="150" y="98" width="36" height="36" rx="3" />
        <circle cx="198" cy="104" r="16" />
      </g>
      <path d={basket} fill={PAPER} />
      <Hatch uid={uid} id="weave" d={basket} gap={9} slant={0} opacity={0.3} />
      <g clipPath={`url(#${uid}-weave)`} stroke={INK} strokeWidth="1" opacity=".45">
        {Array.from({ length: 6 }, (_, i) => <line key={i} x1="90" y1={140 + i * 16} x2="310" y2={140 + i * 16} />)}
      </g>
      <path d={basket} {...line} strokeWidth={2.4} />
      <rect x="90" y="116" width="220" height="14" rx="4" fill={PAPER} {...line} strokeWidth={2} />
      <path d="M188 116 L 188 226 M212 116 L 212 226" {...line} stroke={BERRY} />
      <path d="M200 120 C 172 92, 152 112, 174 126 Z M200 120 C 228 92, 248 112, 226 126 Z" {...line} fill={PAPER} stroke={BERRY} />
      <circle cx="200" cy="122" r="5" fill={BERRY} />
    </g>
  );
}

function Platter({ uid }: { uid: string }) {
  return (
    <g transform="translate(200 190) scale(1.12) translate(-200 -196)">
      <g {...line} strokeWidth={2.2}>
        <path d="M44 200 v8 a156 44 0 0 0 312 0 v-8" fill={PAPER} />
        <ellipse cx="200" cy="200" rx="156" ry="44" fill={PAPER} />
      </g>
      {[[132, 192], [152, 206], [170, 190]].map(([x, y], i) => (
        <g key={i} {...line} strokeWidth={1.5}>
          <circle cx={x} cy={y} r="13" fill={PAPER} />
          <path d={`M${x - 7} ${y} a7 7 0 0 1 14 0 a4 4 0 0 1 -8 0`} />
        </g>
      ))}
      <path d="M200 176 L 248 176 L 224 210 Z" {...line} fill={PAPER} strokeWidth={1.8} />
      <Hatch uid={uid} id="pl" d="M224 210 L 248 176 L 242 176 L 222 204 Z" gap={2.6} slant={0} opacity={0.7} />
      <g {...line} strokeWidth={1.5} fill={PAPER}>
        {[[284, 196], [294, 204], [286, 210], [298, 192], [304, 202]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="6.5" />)}
        {[0, 1, 2].map((i) => <rect key={i} x={188 + i * 5} y={210 - i * 2} width="40" height="10" rx="2" transform={`rotate(${-8 + i * 4} 206 214)`} />)}
      </g>
      <Holly x={98} y={176} s={0.75} flip />
    </g>
  );
}

function Gift() {
  return (
    <g {...line}>
      <rect x="128" y="124" width="144" height="100" fill={PAPER} strokeWidth={2.4} />
      <rect x="118" y="106" width="164" height="26" fill={PAPER} strokeWidth={2.4} />
      <path d="M188 106 V224 M212 106 V224" stroke={BERRY} />
      <path d="M200 108 C 164 70, 146 100, 178 110 Z M200 108 C 236 70, 254 100, 222 110 Z" fill={PAPER} stroke={BERRY} />
    </g>
  );
}

const DRAW: Record<Kind, (p: { uid: string }) => JSX.Element> = {
  ham: Ham,
  joint: Joint,
  sliced: Sliced,
  turkey: Turkey,
  pie: Pie,
  mincePies: MincePies,
  sausages: Sausages,
  stuffing: Stuffing,
  cheese: Cheese,
  hamper: Hamper,
  platter: Platter,
  gift: Gift,
};

export function ProductArt({ name, section, className, fit = "slice" }: { name: string; section?: string | null; className?: string; fit?: "slice" | "meet" }) {
  const uid = `pa${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const Art = DRAW[artKind(name, section)];
  return (
    <svg className={`product-art${className ? ` ${className}` : ""}`} viewBox="0 0 400 300" role="img" aria-label={`Illustration: ${name}`} preserveAspectRatio={`xMidYMid ${fit}`}>
      <rect width="400" height="300" fill={GROUND} />
      {/* The label frame: a double oval rule in gold. */}
      <ellipse cx="200" cy="152" rx="174" ry="124" fill={PAPER} opacity=".6" />
      <g fill="none" stroke={GOLD}>
        <ellipse cx="200" cy="152" rx="182" ry="132" strokeWidth="1.2" />
        <ellipse cx="200" cy="152" rx="175" ry="125" strokeWidth="0.6" />
      </g>
      <Art uid={uid} />
    </svg>
  );
}

/** Decorative holly sprig for headings and the hero. */
export function HollySprig({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-50 -40 100 80" aria-hidden="true" focusable="false">
      <Holly x={0} y={0} s={1} />
      <Holly x={0} y={0} s={1} flip />
    </svg>
  );
}
