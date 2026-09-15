import { motion } from 'framer-motion'

export function ScoreRing({ score, size = 180, dark = false }: { score: number; size?: number; dark?: boolean }) {
  const r = 42; const circumference = 2 * Math.PI * r
  return <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Travel Weather Score ${score} out of 100`}>
    <svg viewBox="0 0 100 100" className="-rotate-90"><circle cx="50" cy="50" r={r} fill="none" stroke={dark ? 'rgba(255,255,255,.1)' : 'rgba(23,75,54,.1)'} strokeWidth="7" /><motion.circle cx="50" cy="50" r={r} fill="none" stroke="#dfa34a" strokeLinecap="round" strokeWidth="7" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - score / 100) }} transition={{ duration: 1.2, ease: 'easeOut' }} /></svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-semibold tracking-[-.05em]">{score}</span><span className={`mt-0.5 text-[9px] font-bold uppercase tracking-[.16em] ${dark ? 'text-white/50' : 'text-slate'}`}>out of 100</span></div>
  </div>
}
