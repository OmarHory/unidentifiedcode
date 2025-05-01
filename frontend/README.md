# SpeakCode Frontend

This is the frontend for the SpeakCode application. It's built with React/Next.js and provides a voice-first LLM-powered pair programming experience.

## Directory Structure

- `components/`: React components
- `contexts/`: React context providers
- `lib/`: Utility functions and API clients
- `pages/`: Next.js pages
- `public/`: Static assets
- `styles/`: CSS styles

## Getting Started

1. Make sure you have Node.js installed (v16+)

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Key Features

- File explorer with file creation and editing
- Code editor with syntax highlighting
- Voice chat interface for LLM interaction
- ASR (Automatic Speech Recognition) for voice transcription
- TTS (Text-to-Speech) for LLM responses

## Building for Production

```
npm run build
npm start
``` 