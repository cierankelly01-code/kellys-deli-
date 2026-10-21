/* Kelly's brand marks: the laurel crest (a "K" monogram in a wreath) and the fine
 * ornamental rule used under headings. Drawn as line work in the brand gold so they
 * sit on ivory or deep green alike. Purely decorative — hidden from screen readers. */

function Laurel({ flip = false }: { flip?: boolean }) {
  // Leaves follow an arc from the base up one side of the wreath.
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const t = (i + 0.6) / 10;
    const a = Math.PI * (0.62 + t * 0.78); // sweep up the left side
    const x = 50 + Math.cos(a) * 38;
    const y = 52 - Math.sin(a) * 38 + 14;
    const rot = (a * 180) / Math.PI - 90 + 38;
    return <ellipse key={i} cx={x} cy={y} rx="7.5" ry="2.9" transform={`rotate(${rot} ${x} ${y})`} />;
  });
  return (
    <g transform={flip ? "translate(100 0) scale(-1 1)" : undefined}>
      <path d="M50 96 C 24 90, 10 66, 16 34" fill="none" />
      <g>{leaves}</g>
    </g>
  );
}

export function Crest({ className, title = false }: { className?: string; title?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 100 104" aria-hidden={title ? undefined : true} role={title ? "img" : undefined} aria-label={title ? "Kelly's" : undefined} focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <Laurel />
        <Laurel flip />
        <path d="M44 96 L50 100 L56 96" />
      </g>
      <path d="M50 10 l1.6 4.2 4.4.2-3.5 2.7 1.2 4.3-3.7-2.5-3.7 2.5 1.2-4.3-3.5-2.7 4.4-.2z" fill="currentColor" />
      <text x="50" y="68" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontSize="44" fontWeight="500" fill="currentColor">K</text>
    </svg>
  );
}

/** A fine rule with a centre lozenge: ——— ◆ ——— */
export function Ornament({ className }: { className?: string }) {
  return (
    <svg className={className ?? "ornament"} viewBox="0 0 160 12" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1" fill="none">
        <path d="M2 6 H64 M96 6 H158" />
        <path d="M72 6 H88" opacity=".6" />
      </g>
      <path d="M80 1.5 L84.5 6 L80 10.5 L75.5 6 Z" fill="currentColor" />
      <circle cx="68" cy="6" r="1.2" fill="currentColor" />
      <circle cx="92" cy="6" r="1.2" fill="currentColor" />
    </svg>
  );
}
