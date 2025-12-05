<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1d421nI69aivY22m4TfLawZF83a-GvCtW

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` and set `VITE_GEMINI_API_KEY=<your_key>` (Vite requires the `VITE_` prefix).  
   If you already have `API_KEY` set, it will also be picked up.
3. Run the app:
   `npm run dev`

### Mobile / Web App usage
- Host the built app over **https** so browsers allow microphone access on phones.
- If you are not running inside AI Studio, paste your Gemini API key into the landing screen (it is stored locally in your browser).
- Works on modern desktop and mobile browsers (Chrome, Edge, Safari).
