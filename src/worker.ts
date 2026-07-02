import {
	type AgentConfig,
	DEFAULT_CONFIG,
	loadConfig,
	saveConfig,
} from "./config.ts";
import {
	guessMediaType,
	parseEpisodeFromFilename,
	readMpvState,
} from "./players/mpv.ts";
import { postScrobbleEvent, testWebhook, type PlaybackState } from "./scrobble.ts";
import uiHtml from "../public/index.html" with { type: "text" };

const PORT = 38472;

type AgentStatus = {
	running: boolean;
	lastPoll: string | null;
	lastTitle: string | null;
	lastProgress: number | null;
	lastError: string | null;
	lastSent: string | null;
	mpvConnected: boolean;
};

let config: AgentConfig = { ...DEFAULT_CONFIG };
let status: AgentStatus = {
	running: false,
	lastPoll: null,
	lastTitle: null,
	lastProgress: null,
	lastError: null,
	lastSent: null,
	mpvConnected: false,
};

let lastExternalId = "";
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function pollOnce(): Promise<void> {
	status.lastPoll = new Date().toISOString();
	const mpv = await readMpvState(config.mpvSocket);
	status.mpvConnected = mpv !== null;

	if (!mpv || mpv.idle || !config.token.trim()) {
		if (mpv?.idle && lastExternalId) {
			// playback ended
			await sendStop(lastExternalId, mpv);
			lastExternalId = "";
		}
		return;
	}

	const ep = parseEpisodeFromFilename(mpv.filename || mpv.title);
	const mediaType = guessMediaType(mpv.filename || mpv.title);
	const externalId = `mpv:${mpv.filename || mpv.title}`;

	status.lastTitle = mpv.title;
	status.lastProgress = mpv.percent;

	const state: PlaybackState = {
		title: mpv.title,
		mediaType,
		progress: mpv.percent,
		season: ep.season,
		episode: ep.episode,
		durationMs: mpv.durationMs,
		positionMs: mpv.positionMs,
		externalId,
	};

	lastExternalId = externalId;

	try {
		const event = mpv.percent >= 85 ? "scrobble" : "playback";
		const res = await postScrobbleEvent(config, event, state);
		if (!res.ok) {
			status.lastError = `Webhook HTTP ${res.status}`;
		} else {
			status.lastError = null;
			status.lastSent = new Date().toISOString();
		}
	} catch (err) {
		status.lastError = err instanceof Error ? err.message : String(err);
	}
}

async function sendStop(
	externalId: string,
	mpv: NonNullable<Awaited<ReturnType<typeof readMpvState>>>,
): Promise<void> {
	const ep = parseEpisodeFromFilename(mpv.filename || mpv.title);
	try {
		await postScrobbleEvent(config, "stop", {
			title: mpv.title,
			mediaType: guessMediaType(mpv.filename || mpv.title),
			progress: mpv.percent,
			season: ep.season,
			episode: ep.episode,
			durationMs: mpv.durationMs,
			positionMs: mpv.positionMs,
			externalId,
		});
		status.lastSent = new Date().toISOString();
	} catch (err) {
		status.lastError = err instanceof Error ? err.message : String(err);
	}
}

function startPolling(): void {
	stopPolling();
	status.running = true;
	void pollOnce();
	pollTimer = setInterval(() => void pollOnce(), config.pollIntervalMs);
}

function stopPolling(): void {
	status.running = false;
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

const server = Bun.serve({
	port: PORT,
	hostname: "127.0.0.1",
	async fetch(req) {
		const url = new URL(req.url);

		if (url.pathname === "/" || url.pathname === "/index.html") {
			return new Response(uiHtml, {
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}

		if (url.pathname === "/api/status") {
			return Response.json({ config, status });
		}

		if (url.pathname === "/api/config" && req.method === "GET") {
			return Response.json(config);
		}

		if (url.pathname === "/api/config" && req.method === "POST") {
			const body = (await req.json()) as Partial<AgentConfig>;
			config = { ...config, ...body };
			await saveConfig(config);
			if (status.running) startPolling();
			return Response.json({ ok: true });
		}

		if (url.pathname === "/api/test" && req.method === "POST") {
			const result = await testWebhook(config);
			return Response.json(result);
		}

		if (url.pathname === "/api/start" && req.method === "POST") {
			startPolling();
			return Response.json({ ok: true });
		}

		if (url.pathname === "/api/stop" && req.method === "POST") {
			stopPolling();
			return Response.json({ ok: true });
		}

		return new Response("Not Found", { status: 404 });
	},
});

config = await loadConfig();
startPolling();

console.log(`WMTW Agent API listening on http://127.0.0.1:${server.port}`);