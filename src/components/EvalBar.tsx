import { motion } from "framer-motion";
import { useTheme } from "../theme";

interface EvalBarProps {
  /** Evaluation in centipawns from White's perspective. Positive = white winning. */
  evaluation: number;
  orientation: "white" | "black";
}

export function EvalBar({ evaluation, orientation }: EvalBarProps) {
  const { theme } = useTheme();
  // Clamp evaluation between -2000 and +2000 centipawns
  const clamped = Math.max(-2000, Math.min(2000, evaluation));
  // Convert to percentage of bar that is "white's share"
  // At 0, it's 50/50. At +2000, 100% white. At -2000, 0% white.
  const whitePct = 50 + (clamped / 2000) * 50;
  const blackPct = 100 - whitePct;

  const topColor = orientation === "white" ? "black" : "white";

  return (
    <div
      className={`relative h-full w-6 overflow-hidden rounded-md border shadow-inner ${
        theme === "dark" ? "border-slate-700" : "border-slate-300"
      }`}
      title={`Evaluation: ${(evaluation / 100).toFixed(2)}`}
    >
      <div
        className={`absolute inset-x-0 ${topColor === "black" ? "top-0" : "bottom-0"}`}
        style={{
          height: `${topColor === "black" ? blackPct : whitePct}%`,
          backgroundColor: theme === "dark" ? "#0f172a" : "#1e293b",
          transition: "height 400ms ease-out",
        }}
      />
      <div
        className={`absolute inset-x-0 ${topColor === "white" ? "top-0" : "bottom-0"}`}
        style={{
          height: `${topColor === "white" ? blackPct : whitePct}%`,
          backgroundColor: theme === "dark" ? "#f1f5f9" : "#f8fafc",
          transition: "height 400ms ease-out",
        }}
      />
      <motion.div
        className={`absolute left-0 right-0 h-0.5 ${
          theme === "dark" ? "bg-amber-400" : "bg-amber-500"
        }`}
        initial={false}
        animate={{
          [orientation === "white" ? "bottom" : "top"]: `${whitePct}%`,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
      <div
        className={`absolute left-1/2 -translate-x-1/2 text-[9px] font-bold ${
          theme === "dark" ? "text-amber-300" : "text-amber-700"
        }`}
        style={{ [orientation === "white" ? "bottom" : "top"]: `${whitePct}%`, transform: "translate(-50%, -50%)" }}
      >
        {evaluation >= 0 ? "+" : ""}
        {(evaluation / 100).toFixed(1)}
      </div>
    </div>
  );
}
