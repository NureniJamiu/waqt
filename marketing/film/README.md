# Waqt product film

A one-minute film of Waqt doing its job, rendered from code:

- `stage.html`: the scene. A laptop, an external monitor and a portrait monitor
  plugged in mid-pause, each with a working desktop (editor, team chat, calendar,
  docs, logs). The **real** Waqt toast and overlay screens run inside it as
  iframes, plus a camera, captions and an end card. `window.TL` holds the timeline.
- `render.mjs`: serves the built app beside the stage and screenshots it frame
  by frame with Playwright. A fake clock drives every timer, so the countdowns on
  screen are the app's own: 12:17 in Lagos on 15 Oct 2026, Dhuhr 12:33, lock 12:23.
- `audio.mjs`: synthesises the music bed and every sound effect, then adds the
  app's toast chime, the first two takbirs of the adhan (`public/assets/takbeer.mp3`)
  and the narration cut from `vo/waqt-voice.mp3` by `vo/cues.json` → `work/mix.wav`.
  The devices are linked by cables in the scene; a signal runs down each one as
  the overlay reaches that display.
- `encode.swift`: frames + mix → H.264/AAC MP4 with AVFoundation (no ffmpeg).
- `VOICEOVER.md`: the narration, how it is cut and where each phrase lands.

## Build

```sh
sh build.sh              # everything (rendering takes ~15–20 min)
sh build.sh --audio-only # re-mix and re-encode with existing frames (after a voice change)
```

Outputs `marketing/waqt-film-master.mp4` (1080p) and the web cut used by the
landing page, `public/landing/waqt-demo.mp4`, plus its poster.

Requires macOS, Node 20+, and Google Chrome (Playwright drives the installed Chrome).

If you change times in `stage.html`'s `window.TL`, update `TL` in
`audio.mjs`, the `at` times in `vo/cues.json` and the chapter times in `src/screens/Landing/HowItWorks.tsx`.
