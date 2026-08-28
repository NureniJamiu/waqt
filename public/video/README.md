# Hero Background Video Assets

Place your background video files in this directory:

- `public/video/mosque-ambient.mp4` (H.264 MP4 format, muted, < 3MB)
- `public/video/mosque-ambient.webm` (VP9 WebM format, muted, < 3MB)
- `public/hero-poster.jpg` (High resolution static frame for fallback while video loads)

The `HeroSection.tsx` component is pre-configured to automatically attempt loading `mosque-ambient.webm` first with `mosque-ambient.mp4` fallback. If no video file is present yet, it gracefully displays the high-quality dark gradient ambient poster.
