import { ArrowRight, Calculator, Code2, Languages, Lock, Plus } from 'lucide-react';

interface CategoryScreenProps {
  languageCount: number;
  totalWordCount: number;
  onSelectLanguages: () => void;
}

export function CategoryScreen({
  languageCount,
  totalWordCount,
  onSelectLanguages,
}: CategoryScreenProps) {
  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-16 space-y-10">
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <p className="text-sm font-medium tracking-wide text-[#B45309] dark:text-[#F59E0B]">
          Noor Language Studio
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1917] dark:text-[#F5F2EC]">
          What would you like to study?
        </h1>
        <p className="text-sm sm:text-base text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
          Choose a learning track to open your decks, flashcards, and active recall quizzes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* 1. Language (Dil) — Active */}
        <button
          type="button"
          onClick={onSelectLanguages}
          className="group text-left bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] hover:border-[#B45309] dark:hover:border-[#D97706] rounded-2xl p-6 sm:p-7 flex flex-col justify-between min-h-[196px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#B45309]/10 dark:bg-[#D97706]/15 border border-[#B45309]/20 dark:border-[#D97706]/25 flex items-center justify-center text-[#B45309] dark:text-[#F59E0B] transition-colors group-hover:bg-[#B45309] group-hover:text-white dark:group-hover:bg-[#D97706] dark:group-hover:text-[#121110]">
              <Languages className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-[#A8A29E] group-hover:text-[#B45309] dark:group-hover:text-[#F59E0B] transition-transform duration-200 group-hover:translate-x-0.5" />
          </div>

          <div className="space-y-1.5 pt-6">
            <div className="flex items-baseline gap-2">
              <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                Language
              </h2>
              <span className="text-sm text-[#78716C] dark:text-[#A8A29E]">
                (Dil)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E]">
              Vocabulary decks, 3D flashcards, and multi-mode quizzes.
            </p>
            <div className="pt-1 text-xs font-medium text-[#B45309] dark:text-[#F59E0B] tabular-nums">
              {languageCount} languages · {totalWordCount} words ready
            </div>
          </div>
        </button>

        {/* 2. Mathematics (Riyaziyyat) — Locked */}
        <div
          aria-disabled="true"
          className="bg-[#F3EFE8]/60 dark:bg-[#171513]/70 border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-6 sm:p-7 flex flex-col justify-between min-h-[196px] opacity-60 cursor-not-allowed select-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/70 dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] flex items-center justify-center text-[#78716C] dark:text-[#A8A29E]">
              <Calculator className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#2E2A25] bg-white/80 dark:bg-[#1C1A17] text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] whitespace-nowrap">
              <Lock className="w-3 h-3" />
              Coming Soon
            </span>
          </div>

          <div className="space-y-1.5 pt-6">
            <div className="flex items-baseline gap-2">
              <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                Mathematics
              </h2>
              <span className="text-sm text-[#78716C] dark:text-[#A8A29E]">
                (Riyaziyyat)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E]">
              Formulas, mental drills, and step-by-step problem sets.
            </p>
          </div>
        </div>

        {/* 3. Programming (Proqramlaşdırma) — Locked */}
        <div
          aria-disabled="true"
          className="bg-[#F3EFE8]/60 dark:bg-[#171513]/70 border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-6 sm:p-7 flex flex-col justify-between min-h-[196px] opacity-60 cursor-not-allowed select-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/70 dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] flex items-center justify-center text-[#78716C] dark:text-[#A8A29E]">
              <Code2 className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#2E2A25] bg-white/80 dark:bg-[#1C1A17] text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] whitespace-nowrap">
              <Lock className="w-3 h-3" />
              Coming Soon
            </span>
          </div>

          <div className="space-y-1.5 pt-6">
            <div className="flex items-baseline gap-2">
              <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                Programming
              </h2>
              <span className="text-sm text-[#78716C] dark:text-[#A8A29E]">
                (Proqramlaşdırma)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E]">
              Syntax recall, algorithm concepts, and code snippets.
            </p>
          </div>
        </div>

        {/* 4. + Custom — Locked */}
        <div
          aria-disabled="true"
          className="bg-[#F3EFE8]/40 dark:bg-[#171513]/50 border border-dashed border-slate-300 dark:border-[#3A352F] rounded-2xl p-6 sm:p-7 flex flex-col justify-between min-h-[196px] opacity-60 cursor-not-allowed select-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/60 dark:bg-[#1C1A17] border border-dashed border-slate-300 dark:border-[#3A352F] flex items-center justify-center text-[#78716C] dark:text-[#A8A29E]">
              <Plus className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#2E2A25] bg-white/80 dark:bg-[#1C1A17] text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] whitespace-nowrap">
              <Lock className="w-3 h-3" />
              Coming Soon
            </span>
          </div>

          <div className="space-y-1.5 pt-6">
            <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              + Custom
            </h2>
            <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E]">
              Build custom study categories tailored to any subject.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
