import { useId } from "react";

/* Drawn product art for the Christmas range — shown wherever a product has no photo yet,
 * so the menu reads as designed rather than a grid of empty boxes. These are plainly
 * illustrations (never passed off as photos of the food), in the seasonal palette. */

type Kind = "ham" | "turkey" | "pie" | "mincePies" | "sausages" | "stuffing" | "cheese" | "hamper" | "platter" | "gift";

const C = {
  green: "#1b3a2d",
  greenSoft: "#2f5a46",
  berry: "#9b2232",
  gold: "#b8913f",
  goldSoft: "#e3c98d",
  cream: "#fbf7ef",
  paper: "#f3ead8",
  wood: "#b98a5b",
  woodDark: "#93673f",
  glaze: "#c0662f",
  glazeLight: "#de8f4f",
  pastry: "#d9a45f",
  pastryDark: "#b77d3c",
  ink: "#1d2721",
};

/** Pick the drawing from the product's name, falling back to its section — so "Pigs in
 * Blankets" in "Turkey & Trimmings" draws sausages, not a turkey. */
export function artKind(name: string, section?: string | null): Kind {
  return kindFor(name.toLowerCase()) ?? kindFor((section ?? "").toLowerCase()) ?? "gift";
}

function kindFor(n: string): Kind | null {
  if (!n) return null;
  if (/hamper|gift/.test(n)) return "hamper";
  if (/ham\b|gammon|joint/.test(n)) return "ham";
  if (/turkey/.test(n)) return "turkey";
  if (/mince/.test(n)) return "mincePies";
  if (/pork pie|pie/.test(n)) return "pie";
  if (/stuffing/.test(n)) return "stuffing";
  if (/blanket|sausage|chipolata|trimming/.test(n)) return "sausages";
  if (/cheese|stilton|brie|cheddar/.test(n)) return "cheese";
  if (/platter|board|grazing|party/.test(n)) return "platter";
  return null;
}

function Board({ cy = 222, rx = 150 }: { cy?: number; rx?: number }) {
  return (
    <g>
      <ellipse cx="200" cy={cy + 6} rx={rx} ry="30" fill={C.woodDark} />
      <ellipse cx="200" cy={cy} rx={rx} ry="30" fill={C.wood} />
      <ellipse cx="200" cy={cy - 2} rx={rx - 18} ry="22" fill="#c69a6c" opacity=".55" />
    </g>
  );
}

function Holly({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M0 0 C 8 -14, 26 -16, 40 -10 C 34 -6, 36 0, 30 2 C 26 -2, 20 2, 16 -2 C 12 4, 6 2, 0 0 Z" fill={C.green} />
      <path d="M0 0 C 2 16, 16 26, 32 28 C 28 22, 32 18, 28 14 C 22 16, 20 10, 16 12 C 14 6, 6 6, 0 0 Z" fill={C.greenSoft} />
      <circle cx="-2" cy="-4" r="6" fill={C.berry} />
      <circle cx="8" cy="-8" r="5" fill={C.berry} />
      <circle cx="4" cy="4" r="5" fill="#b4303f" />
    </g>
  );
}

function Ham({ uid }: { uid: string }) {
  const body = "M118 196 C 104 132, 192 86, 268 108 C 326 124, 330 190, 286 208 C 236 228, 136 226, 118 196 Z";
  return (
    <g>
      <Board />
      <defs>
        <clipPath id={`${uid}-ham`}><path d={body} /></clipPath>
        <linearGradient id={`${uid}-glaze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.glazeLight} />
          <stop offset="1" stopColor={C.glaze} />
        </linearGradient>
      </defs>
      <path d={body} fill={`url(#${uid}-glaze)`} />
      <g clipPath={`url(#${uid}-ham)`} stroke="#8e4019" strokeWidth="2.2" opacity=".55">
        {Array.from({ length: 12 }, (_, i) => <line key={`a${i}`} x1={60 + i * 26} y1="60" x2={-40 + i * 26} y2="240" />)}
        {Array.from({ length: 12 }, (_, i) => <line key={`b${i}`} x1={60 + i * 26} y1="240" x2={-40 + i * 26} y2="60" />)}
      </g>
      <g clipPath={`url(#${uid}-ham)`} fill="#4a2410">
        {Array.from({ length: 30 }, (_, i) => {
          const col = i % 6;
          const row = Math.floor(i / 6);
          return <circle key={i} cx={152 + col * 26 + (row % 2) * 13} cy={112 + row * 22} r="2.6" />;
        })}
      </g>
      <path d="M150 128 C 186 104, 236 100, 270 116" stroke="#fff" strokeOpacity=".35" strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="84" y="182" width="44" height="16" rx="8" fill={C.paper} stroke="#d9cdb4" transform="rotate(-18 106 190)" />
      <circle cx="82" cy="200" r="11" fill={C.paper} stroke="#d9cdb4" />
      <circle cx="78" cy="188" r="9" fill={C.paper} stroke="#d9cdb4" />
      <Holly x={290} y={214} s={0.9} />
    </g>
  );
}

function Turkey({ uid }: { uid: string }) {
  return (
    <g>
      <Board />
      <defs>
        <radialGradient id={`${uid}-roast`} cx=".4" cy=".3" r=".8">
          <stop offset="0" stopColor="#e8a865" />
          <stop offset=".7" stopColor="#c27b3d" />
          <stop offset="1" stopColor="#9c5a26" />
        </radialGradient>
      </defs>
      <path d="M104 210 C 100 130, 160 92, 200 92 C 240 92, 300 130, 296 210 Z" fill={`url(#${uid}-roast)`} />
      <path d="M200 96 C 196 140, 196 180, 200 210" stroke="#8a4b1d" strokeWidth="3" opacity=".5" fill="none" />
      <path d="M140 140 C 160 118, 180 110, 196 108" stroke="#fff" strokeOpacity=".35" strokeWidth="7" fill="none" strokeLinecap="round" />
      {[130, 170, 230, 270].map((x) => (
        <path key={x} d={`M${x} ${x < 200 ? 200 - (x - 104) * 0.2 : 200 - (296 - x) * 0.2} C ${x} 160, ${x + (x < 200 ? 10 : -10)} 120, ${x + (x < 200 ? 22 : -22)} 112`} stroke={C.paper} strokeWidth="2.5" fill="none" opacity=".8" />
      ))}
      <g stroke={C.greenSoft} strokeWidth="3" strokeLinecap="round">
        <path d="M290 222 L 340 196" />
        {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${296 + i * 6} ${219 - i * 3} l ${i % 2 ? 6 : -4} ${i % 2 ? -10 : -12}`} />)}
      </g>
      <circle cx="96" cy="222" r="7" fill={C.berry} />
      <circle cx="110" cy="230" r="6" fill="#b4303f" />
    </g>
  );
}

function Pie() {
  return (
    <g>
      <Board />
      <rect x="128" y="128" width="144" height="82" rx="10" fill={C.pastryDark} />
      <rect x="128" y="128" width="144" height="60" rx="10" fill={C.pastry} />
      <ellipse cx="200" cy="128" rx="72" ry="22" fill="#e7b874" />
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return <circle key={i} cx={200 + Math.cos(a) * 70} cy={128 + Math.sin(a) * 21} r="6" fill={C.pastryDark} />;
      })}
      <ellipse cx="200" cy="126" rx="12" ry="5" fill="#7a4a1c" />
      <path d="M176 120 l -16 -6 M224 120 l 16 -6" stroke={C.pastryDark} strokeWidth="4" strokeLinecap="round" />
      <path d="M150 150 C 160 145, 175 145, 185 150" stroke="#fff" strokeOpacity=".3" strokeWidth="5" fill="none" strokeLinecap="round" />
      <Holly x={84} y={214} s={0.85} flip />
    </g>
  );
}

function MincePies() {
  const pie = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="18" rx="44" ry="12" fill={C.pastryDark} />
      <path d="M-44 0 L -38 18 L 38 18 L 44 0 Z" fill={C.pastry} />
      <ellipse cx="0" cy="0" rx="44" ry="13" fill="#e7b874" />
      <path d="M0 -10 L 4 -2 L 13 -2 L 6 3 L 9 11 L 0 6 L -9 11 L -6 3 L -13 -2 L -4 -2 Z" fill="#f6dfb0" stroke={C.pastryDark} strokeWidth="1.2" />
      <ellipse cx="0" cy="0" rx="44" ry="13" fill="none" stroke="#fff" strokeOpacity=".5" strokeDasharray="2 6" />
    </g>
  );
  return (
    <g>
      <ellipse cx="200" cy="222" rx="150" ry="30" fill="#e9e2d3" />
      <ellipse cx="200" cy="216" rx="150" ry="30" fill="#fff" />
      {pie(140, 192, 1)}
      {pie(262, 192, 1)}
      {pie(200, 158, 1.05)}
      <g fill="#fff" opacity=".9">
        {[[120, 120], [300, 112], [210, 92], [160, 98]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.5" />)}
      </g>
    </g>
  );
}

function Sausages() {
  const banger = (x: number, y: number, r: number) => (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-40" y="-12" width="80" height="24" rx="12" fill="#b06a3c" />
      <rect x="-40" y="-12" width="80" height="10" rx="5" fill="#cf8a55" />
      <path d="M-24 -13 C -18 0, -18 6, -24 13 L -10 13 C -4 6, -4 0, -10 -13 Z" fill="#c9545a" />
      <path d="M2 -13 C 8 0, 8 6, 2 13 L 16 13 C 22 6, 22 0, 16 -13 Z" fill="#c9545a" />
      <path d="M-22 -10 l 8 0 M4 -10 l 8 0" stroke="#f3c3b9" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
  return (
    <g>
      <ellipse cx="200" cy="230" rx="160" ry="40" fill="#1f3f31" />
      <ellipse cx="200" cy="222" rx="160" ry="40" fill={C.green} />
      <ellipse cx="200" cy="220" rx="136" ry="30" fill={C.greenSoft} />
      {banger(146, 214, -10)}
      {banger(254, 216, 8)}
      {banger(200, 200, -3)}
      {banger(150, 186, 12)}
      {banger(250, 186, -10)}
      <circle cx="330" cy="222" r="10" fill="#8f6a3c" />
      <circle cx="70" cy="220" r="9" fill="#8f6a3c" />
    </g>
  );
}

function Stuffing() {
  const balls = [[140, 196], [180, 204], [222, 204], [262, 196], [160, 172], [202, 178], [244, 172], [202, 152]];
  return (
    <g>
      <ellipse cx="200" cy="222" rx="150" ry="30" fill="#e9e2d3" />
      <ellipse cx="200" cy="216" rx="150" ry="30" fill="#fff" />
      {balls.map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r="24" fill="#9a6232" />
          <circle cx={x - 6} cy={y - 7} r="15" fill="#c48448" />
          {[[-8, 4], [6, -4], [4, 10], [-12, -6]].map(([dx, dy]) => <circle key={`${dx}${dy}`} cx={x + dx} cy={y + dy} r="2.4" fill={C.greenSoft} />)}
        </g>
      ))}
      <g stroke={C.greenSoft} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M300 214 c 14 -10, 26 -10, 38 -4" />
        <path d="M304 222 c 12 4, 24 2, 32 -6" />
      </g>
    </g>
  );
}

function Cheese() {
  return (
    <g>
      <Board />
      {/* Stilton */}
      <rect x="96" y="118" width="110" height="88" rx="8" fill="#efe6cf" />
      <ellipse cx="151" cy="118" rx="55" ry="16" fill="#f7f0dd" />
      <rect x="96" y="128" width="110" height="78" fill="#a98f62" opacity=".35" />
      <g stroke="#5f7182" strokeWidth="2" fill="none" opacity=".75">
        <path d="M108 146 c 10 -6, 16 8, 26 0 s 14 6, 22 -2" />
        <path d="M114 170 c 8 6, 18 -6, 30 2 s 18 -4, 26 4" />
        <path d="M120 190 c 10 -4, 16 6, 28 -2" />
      </g>
      {/* Wedge */}
      <path d="M210 206 L 316 206 L 316 150 Z" fill="#f2c94c" />
      <path d="M210 206 L 316 150 L 296 138 Z" fill="#f7da74" />
      <path d="M316 150 L 316 206 L 330 196 L 330 142 Z" fill="#d9a92a" />
      {[[262, 190, 7], [292, 176, 5], [244, 198, 4], [300, 196, 4]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#d9a92a" />)}
      <g fill="#7d3c98" opacity=".85">
        {[[240, 222], [252, 226], [246, 214], [258, 218]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="7" />)}
      </g>
    </g>
  );
}

function Hamper() {
  return (
    <g>
      <ellipse cx="200" cy="232" rx="140" ry="18" fill="#000" opacity=".08" />
      <path d="M120 120 C 120 50, 280 50, 280 120" stroke={C.woodDark} strokeWidth="10" fill="none" />
      <rect x="226" y="70" width="18" height="70" rx="5" fill={C.green} />
      <rect x="229" y="58" width="12" height="16" rx="3" fill={C.gold} />
      <circle cx="176" cy="104" r="24" fill={C.berry} />
      <rect x="150" y="96" width="34" height="40" rx="4" fill={C.goldSoft} />
      <path d="M96 120 L 304 120 L 284 228 L 116 228 Z" fill={C.wood} />
      <g stroke={C.woodDark} strokeWidth="3" opacity=".6">
        {Array.from({ length: 6 }, (_, i) => <line key={`h${i}`} x1={98 + i * 3.2} y1={136 + i * 17} x2={302 - i * 3.2} y2={136 + i * 17} />)}
        {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={110 + i * 18} y1="120" x2={124 + i * 15.2} y2="228" />)}
      </g>
      <rect x="90" y="112" width="220" height="16" rx="6" fill={C.woodDark} />
      <rect x="186" y="112" width="28" height="116" fill={C.berry} opacity=".92" />
      <path d="M200 120 C 170 92, 150 112, 172 126 Z M200 120 C 230 92, 250 112, 228 126 Z" fill={C.berry} />
      <circle cx="200" cy="122" r="8" fill="#7c1a27" />
    </g>
  );
}

function Platter() {
  return (
    <g>
      <ellipse cx="200" cy="208" rx="160" ry="46" fill={C.woodDark} />
      <ellipse cx="200" cy="200" rx="160" ry="46" fill={C.wood} />
      {[[130, 192], [150, 206], [168, 190]].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r="14" fill="#b8434e" />
          <circle cx={x} cy={y} r="8" fill="#d36d75" />
        </g>
      ))}
      <path d="M200 176 L 248 176 L 224 210 Z" fill="#f2c94c" />
      <path d="M232 196 L 276 186 L 266 214 Z" fill="#f7da74" />
      {[[284, 196], [294, 204], [286, 210], [298, 192], [304, 202]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="7" fill="#6b8e3a" />)}
      {[0, 1, 2, 3].map((i) => <rect key={i} x={186 + i * 4} y={210 - i * 2} width="40" height="10" rx="2" fill="#e7c48a" stroke={C.pastryDark} strokeWidth="1" transform={`rotate(${-8 + i * 4} 206 214)`} />)}
      <Holly x={96} y={174} s={0.8} flip />
    </g>
  );
}

function Gift() {
  return (
    <g>
      <ellipse cx="200" cy="232" rx="110" ry="14" fill="#000" opacity=".08" />
      <rect x="120" y="120" width="160" height="108" rx="6" fill={C.green} />
      <rect x="110" y="104" width="180" height="30" rx="6" fill={C.greenSoft} />
      <rect x="188" y="104" width="24" height="124" fill={C.gold} />
      <path d="M200 106 C 160 64, 140 98, 176 108 Z M200 106 C 240 64, 260 98, 224 108 Z" fill={C.gold} />
    </g>
  );
}

const DRAW: Record<Kind, (p: { uid: string }) => JSX.Element> = {
  ham: Ham,
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
      <defs>
        <radialGradient id={`${uid}-bg`} cx=".5" cy=".42" r=".75">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#efe4cd" />
        </radialGradient>
        <pattern id={`${uid}-stars`} width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M28 20 l 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 Z" fill={C.gold} opacity=".22" />
          <circle cx="6" cy="44" r="1.6" fill={C.gold} opacity=".25" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill={`url(#${uid}-bg)`} />
      <rect width="400" height="300" fill={`url(#${uid}-stars)`} />
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
