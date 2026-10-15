import React, { useState } from "react";
import { Plus } from "lucide-react";

// Answers follow AGENTS.md §1 and §4; keep them in step with the app's behaviour.
const FAQS = [
  {
    q: "Can Waqt trap me in an emergency?",
    a: "Once per prayer, Emergency Dismiss works at any moment, even mid-pause, and gives you thirty minutes. If the pause returns after that, the button is gone by design. Force Quit on a Mac (⌘⌥Esc) or Task Manager on Windows still closes Waqt.",
  },
  {
    q: "When exactly does the screen lock?",
    a: "Ten minutes before the adhan by default, so you reach the masjid or the prayer mat on time. The lead can be set from 0 to 30 minutes and the pause from 1 to 20.",
  },
  {
    q: "Does it need an internet connection?",
    a: "No. Prayer times are calculated on your computer from your coordinates, calculation method and Asr school.",
  },
  {
    q: "What happens with more than one monitor?",
    a: "Every connected display gets its own overlay, and a screen plugged in during the pause is covered within ten seconds.",
  },
  {
    q: "What if my laptop was asleep at prayer time?",
    a: "On waking, Waqt checks the clock. If the prayer's window is still open, the pause starts straight away. If it has closed, the prayer is logged as missed, with no surprise overlay.",
  },
  {
    q: "Is it really free?",
    a: "Yes. Waqt is open source under the MIT licence, with no ads, accounts or paid tier.",
  },
];

export const FAQSection: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative pt-32 md:pt-44 max-w-3xl mx-auto px-6" aria-labelledby="faq-title">
      <div className="text-center">
        <div data-reveal className="ak-eyebrow">Questions</div>
        <h2 data-reveal style={{ ["--i" as string]: 1 }} id="faq-title" className="ak-title mt-5 font-display font-semibold tracking-[-0.03em] text-[clamp(2rem,4vw,3rem)]">
          Fair questions
        </h2>
      </div>
      <dl className="mt-12 space-y-2">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} data-reveal style={{ ["--i" as string]: i }} className={`rounded-xl border transition-colors ${isOpen ? "ak-glass" : "border-slate-800/80 bg-slate-900/20"}`}>
              <dt>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-6 px-5 py-4 text-left group"
                >
                  <span className={`text-[15px] md:text-base transition-colors ${isOpen ? "text-white" : "text-slate-300 group-hover:text-white"}`}>{f.q}</span>
                  <Plus className={`w-4 h-4 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-45 text-emerald-300" : "text-slate-500"}`} />
                </button>
              </dt>
              <dd className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                <p className="overflow-hidden px-5 text-sm md:text-[15px] text-slate-400 leading-relaxed">
                  <span className="block pb-5">{f.a}</span>
                </p>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};
