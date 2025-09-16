# Codebase Modularization Summary

## Overview
The codebase has been successfully cleaned up and modularized to improve maintainability, scalability, and code organization.

## New Modular Structure

### Core Directory (`core/`)
The new modular structure is organized under the `core/` directory:

#### 1. Session Management (`core/interview/`)
- **`InterviewSession.ts`** - Centralized session management with `SessionManager` class
- Handles session creation, retrieval, and cleanup
- Manages all session-related state and data

#### 2. Type Definitions (`core/types/`)
- **`SessionTypes.ts`** - Centralized type definitions for:
  - `CodingStreamState` - Tracks coding input state
  - `SpeechStreamState` - Tracks speech input state  
  - `InvocationState` - Tracks LLM invocation state
  - `WebSocketMessage` - WebSocket message structure
  - `WebSocketResponse` - WebSocket response structure

#### 3. Audio Management (`core/audio/`)
- **`AudioManager.ts`** - Handles all audio-related operations:
  - Deepgram STT integration with websocket connection
  - ElevenLabs TTS synthesis and playback
  - Audio chunk processing and queue management
  - Silence detection and transcript processing

#### 4. Coding Management (`core/coding/`)
- **`CodingManager.ts`** - Manages coding stage logic:
  - **30-second keystroke delay** as requested
  - **1-second Deepgram endpoint threshold** for speech
  - Dual-stream invocation (speech + code)
  - State management for coding and speech inputs
  - Comprehensive message creation

#### 5. Message Processing (`core/messaging/`)
- **`MessageProcessor.ts`** - Handles message processing for non-coding stages:
  - Text input processing
  - Code input processing
  - Silence detection handling
  - Audio playback management

#### 6. Agent Communication (`core/agent/`)
- **`AgentHandler.ts`** - Manages communication with the orchestrator:
  - Sends messages to the LLM orchestrator
  - Handles stage changes and responses
  - Manages scoring and recommendation results

#### 7. WebSocket Server (`core/server/`)
- **`InterviewWebSocketServer.ts`** - Main WebSocket server:
  - Modular architecture using all the above components
  - Clean separation of concerns
  - Proper error handling and connection management

## Key Features Implemented

### 1. Coding Stage Logic
- **Deepgram endpoint threshold**: 1 second (500ms-1sec as requested)
- **Keystroke delay**: 30 seconds before LLM invocation
- **Dual-stream processing**: Handles both speech and code inputs simultaneously
- **Smart invocation**: Only invokes LLM when both speech and code are idle

### 2. Non-Coding Stage Logic
- **Simple flow**: Speech → STT → LLM → TTS → Audio playback
- **Real-time transcription**: Shows partial transcripts as user speaks
- **Final transcript**: Processes complete transcript after silence detection

### 3. Audio Integration
- **Deepgram STT**: Real-time speech-to-text with websocket connection
- **ElevenLabs TTS**: High-quality text-to-speech synthesis
- **Seamless integration**: Audio flows directly through the websocket server

### 4. Orchestrator Integration
- **Wrapped inside WebSocket**: The orchestrator is now fully integrated within the websocket server
- **Stage management**: Automatic stage transitions and state management
- **Response handling**: Proper handling of all orchestrator responses

## Files Cleaned Up

### Deleted Files
- `ws-server/agent.ts` → Replaced by `core/agent/AgentHandler.ts`
- `ws-server/coding.ts` → Replaced by `core/coding/CodingManager.ts`
- `ws-server/types.ts` → Replaced by `core/types/SessionTypes.ts`
- `tests/tesst_cleint.js` → Typo in filename, unused
- `tests/test_greet.js` → Unused test file
- `tests/test_tts.js` → Unused test file
- `tests/testTranscribe.ts` → Unused test file
- `lib/utils/awsPolly.ts` → Replaced by ElevenLabs TTS
- `lib/utils/awsTranscribe.ts` → Replaced by Deepgram STT
- `lib/utils/realtimeSpeech.ts` → Unused legacy file

### Updated Files
- `ws-server/server.ts` → Now imports from modular structure
- `ws-server/constants.ts` → Updated thresholds for new requirements
- `app/components/CodeEditor.tsx` → Updated with new keystroke logic

## Configuration Updates

### New Constants
- `SILENCE_TIMEOUT`: 1500ms (Deepgram endpoint threshold)
- `SAMPLE_RATE`: 48000Hz (Deepgram sample rate)
- `SPEECH_SILENCE_THRESHOLD`: 1000ms (Deepgram endpoint threshold)
- `CODE_IDLE_THRESHOLD`: 30000ms (30 seconds as requested)
- `KEYSTROKE_DEBOUNCE`: 300ms (Immediate feedback debounce)

## Benefits of New Structure

1. **Modularity**: Each component has a single responsibility
2. **Maintainability**: Easy to modify individual components
3. **Testability**: Components can be tested in isolation
4. **Scalability**: Easy to add new features or modify existing ones
5. **Code Reusability**: Components can be reused across different parts of the system
6. **Clean Architecture**: Clear separation of concerns and dependencies

## Usage

The new modular server can be started using the existing npm scripts:
```bash
npm run ws-server
npm run dev:ws
npm run dev:all
```

The server maintains backward compatibility while providing the new modular architecture internally.
