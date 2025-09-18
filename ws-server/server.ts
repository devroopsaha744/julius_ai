import { WebSocketServer, type WebSocket } from 'ws';
import { DeepgramSTTService } from '../lib/utils/deepgramSTT';
import { InterviewOrchestrator } from '../lib/services/orchestrator';
import { textToSpeechBuffer } from '../lib/utils/elevenlabsTTS';
import * as redisHelpers from '../lib/utils/redisSession';

type ClientState = {
	ws: WebSocket;
	sessionId: string;
	stt: DeepgramSTTService;
	orchestrator: InterviewOrchestrator;
	// Transcript buffers
	lastInterim: string;
	lastFinal: string;
	processing: boolean;
	finalQueue: string[];
	lastFinalAt: number | null;
};

function tryParseJson(buf: Buffer): any | null {
	if (!buf || buf.length === 0) return null;
	const b = buf[0];
	if (b !== 0x7b && b !== 0x5b) return null;
	try {
		const s = buf.toString('utf8');
		return JSON.parse(s);
	} catch {
		return null;
	}
}

const PORT = Number(process.env.REALTIME_PORT || 3001);
const wss = new WebSocketServer({ port: PORT });

console.log(`[realtime] WebSocket server listening on ws://localhost:${PORT}`);

// Minimal redis wrapper using existing helpers
const RedisStore = {
	async loadMessages(sessionId: string) {
		try {
			return await redisHelpers.getMessages(sessionId);
		} catch (e) {
			console.error('Redis loadMessages error', e);
			return [];
		}
	},
	async saveMessages(sessionId: string, messages: any[]) {
		try {
			// Clear and push messages as a simple approach
			for (const m of messages) {
				await redisHelpers.addMessage(sessionId, m.role, m.content);
			}
		} catch (e) {
			console.error('Redis saveMessages error', e);
		}
	}
};

wss.on('connection', (ws) => {
	const state: ClientState = {
		ws,
		sessionId: 'default',
		stt: new DeepgramSTTService(),
		orchestrator: new InterviewOrchestrator('default'),
		lastInterim: '',
		lastFinal: '',
		processing: false,
		finalQueue: [],
		lastFinalAt: null,
	};

	const sendJson = (obj: any) => {
		try {
			if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
		} catch (e) {
			// swallow
		}
	};

	sendJson({ type: 'hello', message: 'ws_connected' });

	const enqueueFinal = (text: string) => {
		const t = (text || '').trim();
		if (!t) return;
		state.finalQueue.push(t);
		if (!state.processing) void processQueue();
	};

	const processQueue = async () => {
		if (state.processing) return;
		const next = state.finalQueue.shift();
		if (!next) return;
		state.processing = true;
		try {
			// Load history
			const history = await RedisStore.loadMessages(state.sessionId);
			const messages = [
				...(history as any),
				{ role: 'user', content: next },
			];

			const result = await state.orchestrator.processMessage(next, undefined, undefined);

			// Send agent_response event similar to existing server behavior
			sendJson({ type: 'assistant', text: result.response.assistant_message, currentStage: result.currentStage });

			// Save assistant message to redis
			const updated = [...messages, { role: 'assistant', content: result.response.assistant_message }];
			await RedisStore.saveMessages(state.sessionId, updated as any);

			// Synthesize audio using ElevenLabs (non-blocking)
			if (result.response.assistant_message) {
				(async () => {
					try {
						const speakText = result.response.assistant_message;
						const finalAt = state.lastFinalAt ?? Date.now();
						const mp3 = await textToSpeechBuffer(speakText);
						if (mp3?.length && ws.readyState === ws.OPEN) {
							// send binary MP3 directly
							ws.send(mp3);
						}
					} catch (e) {
						sendJson({ type: 'error', message: `TTS failed: ${String(e)}` });
					}
				})();
			}
		} catch (e: any) {
			sendJson({ type: 'error', message: e?.message || String(e) });
		} finally {
			state.processing = false;
			if (state.finalQueue.length > 0) void processQueue();
		}
	};

	state.stt.setCallbacks(
		(transcript, isFinal) => {
			if (!transcript) return;
			if (isFinal) {
				state.lastFinal = transcript;
				state.lastInterim = '';
				state.lastFinalAt = Date.now();
				sendJson({ type: 'final', text: transcript });
				enqueueFinal(transcript);
			} else {
				state.lastInterim = transcript;
				sendJson({ type: 'interim', text: transcript });
			}
		},
		(err) => {
			sendJson({ type: 'error', message: String(err) });
		},
		undefined
	);

	ws.on('message', async (data: Buffer) => {
		const msg = tryParseJson(data);
		if (msg && typeof msg === 'object') {
			try {
				if (msg.type === 'start') {
					state.sessionId = String(msg.session_id || 'default');
					state.orchestrator = new InterviewOrchestrator(state.sessionId);
					await state.stt.connect();
					sendJson({ type: 'ready' });
					return;
				}
				if (msg.type === 'stop') {
					await state.stt.disconnect();
					state.finalQueue.length = 0;
					state.lastInterim = '';
					state.lastFinal = '';
					state.lastFinalAt = null;
					sendJson({ type: 'stopped' });
					return;
				}
			} catch (e) {
				sendJson({ type: 'error', message: String(e) });
			}
		} else {
			try {
				await state.stt.sendAudio(data);
			} catch (e) {
				sendJson({ type: 'error', message: String(e) });
			}
		}
	});

	ws.on('close', async () => {
		try {
			await state.stt.disconnect();
		} catch {}
		state.finalQueue.length = 0;
	});
});

export default wss;