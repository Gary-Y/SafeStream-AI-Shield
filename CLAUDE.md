# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SafeStream AI Shield is a React-based WebRTC video calling application that uses Google Gemini 2.5 Flash to detect sensitive/NSFW content in real-time and automatically masks detected areas with a privacy overlay.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build
```

**Environment Setup:** Set `GEMINI_API_KEY` in `.env.local` before running.

## Architecture

```
index.tsx                    # React entry point
App.tsx                      # Root component (header + WebRTCContainer)
├── components/
│   ├── WebRTCContainer.tsx  # P2P connection logic via PeerJS, camera/call controls
│   └── VideoProcessor.tsx   # Frame capture, AI detection loop, canvas overlay rendering
├── services/
│   └── geminiService.ts     # Gemini API integration for content detection
└── types.ts                 # Shared TypeScript interfaces (BoundingBox, CallStatus, etc.)
```

### Key Data Flow

1. **WebRTCContainer** manages local/remote MediaStreams and PeerJS connections
2. **VideoProcessor** receives a stream, captures frames at ~2-3 FPS, sends to Gemini
3. **geminiService.detectSensitiveContent** returns normalized bounding boxes (0-1 range)
4. **VideoProcessor** renders masking rectangles on a canvas overlay synced to video dimensions

### Technical Notes

- Video frames are encoded as JPEG (quality 0.6) before API calls to reduce latency
- Detection results use normalized coordinates; conversion to pixels happens in VideoProcessor
- Local video is mirrored by default; frames sent to Gemini match the displayed orientation
- PeerJS handles WebRTC signaling; users exchange peer IDs manually to connect
- Tailwind CSS loaded via CDN in index.html
