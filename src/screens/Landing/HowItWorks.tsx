import React, { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, Lock, Timer, Volume2, VolumeX } from "lucide-react";

// Chapters of /landing/waqt-demo.mp4 (seconds), matching window.TL in
// marketing/film/stage.html. The film runs the real app on 15 Oct 2026 in Lagos:
// Dhuhr 12:33, lock 12:23, button opens 12:38.
const CHAPTERS = [
  { at: 8.6, icon: Bell, label: "Reminders", detail: "30, 15 and 5 minutes before" },
  { at: 14.2, icon: Timer, label: "10s warning", detail: "a countdown in the corner" },
  { at: 18.8, icon: Lock, label: "Every screen locks", detail: "on every display, ten minutes early" },
  { at: 25.6, icon: Volume2, label: "The adhan", detail: "takbeer plays on the overlay" },
  { at: 47.4, icon: CheckCircle2, label: "I've prayed", detail: "after fifteen minutes" },
];

function chapterAt(t: number) {
  let idx = 0;
  CHAPTERS.forEach((c, i) => {
    if (t >= c.at) idx = i;
  });
  return idx;
}

export const HowItWorks: React.FC = () => {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const onTime = () => setActive(chapterAt(v.currentTime));
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, []);

  // Sound on by default, as far as browsers allow. Browsers refuse audible
  // playback until the visitor has interacted with the page, so: try to play
  // with sound when the film comes into view; if that is refused, play muted and
  // unmute on the visitor's first click, tap or key press anywhere on the page.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let started = false;
    let disarm = () => {};

    const armUnmute = () => {
      const unmute = (e: Event) => {
        // our own sound button and chapter tiles handle themselves
        if ((e.target as Element | null)?.closest?.("[data-film-control]")) return;
        v.muted = false;
        setSound(true);
        if (v.paused) void v.play();
        disarm();
      };
      const events = ["pointerdown", "keydown", "touchstart"] as const;
      events.forEach((ev) => window.addEventListener(ev, unmute, { capture: true }));
      disarm = () => events.forEach((ev) => window.removeEventListener(ev, unmute, { capture: true }));
    };

    const start = () => {
      v.currentTime = 0;
      v.muted = false;
      v.play()
        .then(() => setSound(true))
        .catch(() => {
          v.muted = true;
          setSound(false);
          void v.play().catch(() => {});
          armUnmute();
        });
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          if (!started) {
            started = true;
            start();
          } else if (v.paused) void v.play().catch(() => {});
        } else if (started && !v.paused && e.intersectionRatio < 0.2) {
          // don't keep talking once the film has scrolled away
          v.pause();
        }
      },
      { threshold: [0, 0.2, 0.5] }
    );
    io.observe(v);
    return () => {
      io.disconnect();
      disarm();
    };
  }, []);

  const seek = (t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = t;
    void v.play();
  };

  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = sound;
    setSound(!sound);
    if (!sound && v.paused) void v.play();
  };

  return (
    <section id="how-it-works" className="relative pt-32 md:pt-44" aria-labelledby="how-title">
      <div className="text-center px-6">
        <div data-reveal className="ak-eyebrow">How it works</div>
        <h2
          data-reveal
          style={{ ["--i" as string]: 1 }}
          id="how-title"
          className="ak-title mt-5 font-display font-semibold tracking-[-0.03em] leading-[1.05] text-[clamp(2.25rem,4.6vw,3.5rem)]"
        >
          One prayer, from reminder
          <br className="hidden md:block" />
          to “I've prayed”.
        </h2>
        <p data-reveal style={{ ["--i" as string]: 2 }} className="mt-5 text-slate-400 max-w-lg mx-auto leading-relaxed">
          One minute of the real app taking over a laptop and two monitors, with the adhan as the pause begins. Pick a moment to jump to it.
        </p>
      </div>

      {/* Capability rail: tiles joined by a line, each one a chapter of the film */}
      <ol data-reveal style={{ ["--i" as string]: 3 }} className="relative mt-14 max-w-5xl mx-auto px-6 grid grid-cols-5 gap-2" aria-label="Chapters">
        <div className="absolute left-[10%] right-[10%] top-7 h-px bg-slate-700/60" aria-hidden="true" />
        {CHAPTERS.map((c, i) => (
          <li key={c.label} className="relative flex flex-col items-center text-center">
            <button type="button" onClick={() => seek(c.at)} className="ak-tile relative" data-on={i === active} data-film-control aria-label={`Jump to: ${c.label}`}>
              <c.icon className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <span className={`mt-3 text-[13px] transition-colors ${i === active ? "text-white" : "text-slate-400"}`}>{c.label}</span>
            <span className="hidden md:block mt-0.5 text-xs text-slate-500">{c.detail}</span>
          </li>
        ))}
      </ol>

      <div data-reveal style={{ ["--i" as string]: 4 }} className="relative max-w-6xl mx-auto px-4 md:px-6 mt-12">
        <div className="ak-pool -inset-x-20 -top-20 bottom-0" aria-hidden="true" />
        <figure className="relative ak-glass ak-corners overflow-hidden p-2 md:p-3">
          <div className="flex items-center gap-1.5 px-2 pb-2 md:pb-3" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
          </div>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-[#05080e] border border-slate-800">
            <video
              ref={video}
              src="/landing/waqt-demo.mp4"
              poster="/landing/waqt-demo-poster.jpg"
              width={1600}
              height={900}
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
              aria-label="Demo film: the Waqt dashboard, a fifteen-minute reminder, the ten-second warning, then the full-screen prayer overlay with the adhan, and the button unlocking after the pause."
            />
            <button
              type="button"
              onClick={toggleSound}
              data-film-control
              className={`absolute left-3 bottom-3 md:left-4 md:bottom-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
                sound
                  ? "bg-[#070a11]/85 border-slate-700 text-slate-200 hover:border-slate-500"
                  : "bg-emerald-500 border-emerald-400 text-emerald-950 hover:bg-emerald-400 animate-pulse"
              }`}
            >
              {sound ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {sound ? "Mute" : "Tap for sound"}
            </button>
          </div>
        </figure>
        <p className="mt-4 text-center text-xs text-slate-500">
          The overlay and warning are the real app, recorded frame by frame. The adhan is the same recording Waqt plays on the overlay.
        </p>
      </div>
    </section>
  );
};
