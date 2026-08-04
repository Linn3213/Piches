/**
 * Piches-märket: yin/yang i sage och sand, i en avskalad tolkning utan
 * de klassiska prickarna — det är formen som bär, och den håller ner till
 * 24px i navigeringen. Ren SVG, så den följer med i bundlen och kan färgas om.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Piches"
    >
      <circle cx="50" cy="50" r="49" fill="#e8e2d5" />
      <path
        d="M50 1 A49 49 0 0 1 50 99 A24.5 24.5 0 0 1 50 50 A24.5 24.5 0 0 0 50 1"
        fill="#3f694e"
      />
    </svg>
  );
}
