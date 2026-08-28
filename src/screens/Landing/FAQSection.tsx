import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      question: "Can Waqt trap or lock me out during a real emergency?",
      answer:
        "Never. Waqt includes a mandatory Emergency Dismiss Hatch that is immediately clickable 100% of the time—it is never disabled by the forced pause timer. Clicking it presents a single confirmation prompt and logs the event so you can review it later.",
    },
    {
      question: "Does Waqt require an active internet connection?",
      answer:
        "No. Waqt is 100% offline-first. Prayer times are calculated client-side based on your saved coordinates, astronomical calculation method (MWL, ISNA, Makkah, etc.), and Asr school using standard algorithms (adhan-js).",
    },
    {
      question: "Does Waqt use my webcam, keylogger, or record my screen?",
      answer:
        "No. Waqt operates strictly on an honor system. It does not monitor your camera, record your keystrokes, or inspect running background processes. All prayer logs and settings remain strictly on your local disk.",
    },
    {
      question: "How does the multi-monitor forced pause work?",
      answer:
        "At exact prayer time (T-0), Waqt queries all connected monitors and opens a fullscreen borderless window per display. During the forced pause (default 7 minutes), the 'I've Prayed' button remains disabled until the timer reaches zero, giving you structured reflection time.",
    },
    {
      question: "What happens if I wake my computer from sleep mid-day?",
      answer:
        "Waqt evaluates your system clock upon OS wake. If a prayer's time passed while sleeping and it is still before the next prayer's start time, Waqt triggers the overlay immediately. If the window has already expired, it logs 'missed' without popping retroactive screens.",
    },
  ];

  const toggleFAQ = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 bg-slate-950/90 border-t border-slate-800/60 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">
            Got Questions?
          </h2>
          <h3 className="text-3xl sm:text-5xl font-extrabold text-white font-heading">
            Frequently Asked Questions
          </h3>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFAQ(idx)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className="text-base sm:text-lg font-bold text-slate-100">{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-emerald-400 transition-transform duration-300 shrink-0 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
