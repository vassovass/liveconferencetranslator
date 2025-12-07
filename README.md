# Live Conference Translator (Any Language → English)

Browser-based live captioning for conferences and meetups. Automatically detects any spoken language and outputs English captions. English speech is transcribed directly; other languages are translated to English.

Streams audio to Gemini Live and renders near real-time captions with a volume visualizer.

## Why this is here
- Ready-to-run, open-source portfolio app you can showcase or extend.
- Works in Google AI Studio (select a key) or any HTTPS deployment (paste your key).
- Shows live partial captions plus finalized sentences and a simple audio visualizer.

## Accuracy note (please read)
- Using a laptop/phone mic pointed at the room typically yields roughly **40–60% accuracy**, depending on distance, noise, and device quality.
- You will get **much higher accuracy** when the audio is fed **directly from the speaker's microphone or mixer** (line-in / virtual cable / HDMI capture).
- Supports **any language → English** (auto-detection).

## Requirements
- Node.js 18+ and npm.
- A Google Gemini API key with access to `gemini-live-2.5-flash-preview` (Live API model).
- Modern browser (Chrome, Edge, Safari). Use **HTTPS** so browsers allow microphone access on mobile.

## Quick start
1. Clone: `git clone <repo-url> && cd liveconferencetranslator`
2. Install deps: `npm install`
3. Create `.env.local` with your key:
   ```
   VITE_GEMINI_API_KEY=your_api_key
   ```
   (`GEMINI_API_KEY`/`API_KEY` are also read for convenience.)
4. Run dev server: `npm run dev` and open the shown URL (serve over https if possible).
5. Windows one-click (with policy bypass): run `start-dev.bat`  
   - Uses PowerShell `-ExecutionPolicy Bypass` under the hood.  
   - Keeps the window open so you can copy/paste logs.  
   - Runs a Gemini smoke test before starting dev; fails fast if the API key is missing/invalid.
   - For Node inspector: `start-dev.bat --inspect`
6. PowerShell direct: `powershell -ExecutionPolicy Bypass -File .\start-dev.ps1`

## Using the app
- If running inside Google AI Studio, click **Connect API Key**.  
- Otherwise, paste your Gemini API key into the input and **Save & Start**. The key stays in local storage only.
- Click **Start Listening** and allow microphone access. Captions stream live; finalized lines appear above.
- Status pill shows `Ready / Connecting / Live Translation / Connection Error`. The circular visualizer mirrors input volume.
- Press **D** to toggle debug panel for troubleshooting.

## API keys (where to put them)
- **Preferred for local/dev**: add `VITE_GEMINI_API_KEY=your_api_key` to `.env.local`.  
- **AI Studio**: click **Connect API Key** and select your key (no .env needed).  
- **Manual paste**: enter the key in the UI; it is stored only in your browser's local storage.  
- Model used: `gemini-live-2.5-flash-preview` (Live API with TEXT output for captions).

## Deployment
- Build: `npm run build`
- Preview local build: `npm run preview`
- Host the `dist/` folder on any static site host over **HTTPS**.  
- When not in AI Studio, users must paste their own Gemini API key on first load.

## Tech stack
- React 19 + Vite + TypeScript
- Google Gemini Live (`@google/genai`)
- Tailwind (via CDN) for styling

## Troubleshooting
- Mic errors: ensure https and allow microphone permissions; select a working input device.
- Empty captions: confirm the API key is valid and has access to the live model; check network console for 401/403.
- High latency/low accuracy: move the mic closer or feed audio directly from the mixer; reduce room noise.
- Session closes immediately: check the browser console for errors.

## Feature requests / contact
- Want another language pair or UI tweak? Email (plain text): `vasso@auxeon.co`

## License & attribution
- License: MIT (see `LICENSE`).
- Uses Google Gemini API; follow Google's terms of service and brand guidelines when deploying or sharing.
