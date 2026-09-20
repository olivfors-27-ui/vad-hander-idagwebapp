import { cn } from "@/lib/utils";

/**
 * Återkommande visuellt tema för Händer: mjuka, organiska linjer i
 * orange/rött/gult/blått som löper genom sidan som en abstrakt karta.
 * Ligger alltid bakom innehållet (pointer-events-none, z-0).
 */
export function LineBackdrop({
  className,
  opacity = 0.16,
  dense = false,
}: {
  className?: string;
  opacity?: number;
  dense?: boolean;
}) {
  const lines = dense
    ? [
        { d: "M-20 60 C 90 20, 180 110, 300 70 S 420 30, 430 90", color: "var(--line-orange)", w: 2.5 },
        { d: "M-20 140 C 70 180, 170 90, 290 150 S 410 190, 430 130", color: "var(--line-red)", w: 2 },
        { d: "M-20 230 C 100 190, 200 280, 310 230 S 420 260, 440 210", color: "var(--line-yellow)", w: 2.5 },
        { d: "M-20 330 C 80 370, 190 280, 300 340 S 410 300, 430 360", color: "var(--line-blue)", w: 2 },
        { d: "M-20 440 C 90 400, 180 490, 290 440 S 410 470, 430 420", color: "var(--line-orange)", w: 2 },
        { d: "M-20 540 C 70 580, 170 490, 300 550 S 420 510, 440 570", color: "var(--line-red)", w: 2 },
        { d: "M-20 650 C 100 610, 200 700, 310 650 S 420 680, 440 630", color: "var(--line-yellow)", w: 2 },
        { d: "M-20 750 C 80 790, 190 700, 300 760 S 410 720, 430 780", color: "var(--line-blue)", w: 2 },
      ]
    : [
        { d: "M-20 90 C 90 40, 190 140, 300 80 S 420 40, 440 110", color: "var(--line-orange)", w: 2.5 },
        { d: "M-20 300 C 80 350, 180 240, 300 310 S 410 270, 430 330", color: "var(--line-blue)", w: 2 },
        { d: "M-20 520 C 100 470, 200 570, 310 510 S 420 540, 440 490", color: "var(--line-yellow)", w: 2 },
        { d: "M-20 720 C 70 770, 190 660, 300 730 S 410 690, 430 750", color: "var(--line-red)", w: 2 },
      ];

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
        style={{ opacity }}
      >
        {lines.map((l, i) => (
          <path
            key={i}
            d={l.d}
            fill="none"
            stroke={l.color}
            strokeWidth={l.w}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}
