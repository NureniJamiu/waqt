# Waqt film — voiceover

The narration is one recording, `vo/waqt-voice.mp3` (24.6 s, read in a single
take). `vo/cues.json` cuts it into phrases and places each one in the film:

- `from` / `to`: where the phrase sits inside the recording (seconds)
- `at`: where it starts in the film (seconds)
- `html`: the caption shown while it plays (empty for the end card, where the
  title and tagline appear on the words instead)

`audio.mjs` slices the phrases with a little breathing room, high-passes them,
levels the read to about −19 dBFS and ducks the music under it. `stage.html`
reads the same file for its captions, so text and voice cannot drift apart.

| # | In the recording | In the film | Line |
|---|---|---|---|
| 1 | 0.04–1.48 | 0.8 s, the workday | This is your workday. |
| 2 | 1.92–4.90 | 2.8 s, chat + calendar | Meetings stack up, and prayer keeps slipping later. |
| 3 | 5.40–8.78 | 9.4 s, Waqt's notification | Waqt gives you a quiet heads-up, fifteen minutes before. |
| 4 | 9.14–10.84 | 15.0 s, the 10-second toast | Then ten seconds of notice. |
| 5 | 11.18–13.34 | 20.6 s, every screen locks | And every screen pauses for prayer. |
| 6 | 13.66–15.38 | 23.3 s, a display is plugged in | Even one you plug in mid-pause. |
| — | — | 26.0–45 s | *(silence: the adhan plays)* |
| 7 | 15.82–18.04 | 47.7 s, the button opens | The button opens after fifteen minutes. |
| 8 | 18.34–20.60 | 50.2 s, the desktop returns | The rest is between you and Allah. |
| 9 | 21.16–21.68 | 53.2 s, end card title | Waqt. |
| 10 | 21.98–24.60 | 54.0 s, end card tagline | Free, offline, and on your desktop. |

The phrase boundaries were found from the pauses in the recording. If you
re-record, keep the same order and a short breath between lines, then update
`from`/`to` (or ask Claude to re-detect them) and run `sh build.sh --audio-only`.
Moving an `at` also moves its caption, but scene timings live in `window.TL` in
`stage.html`, so a big shift needs a re-render.
