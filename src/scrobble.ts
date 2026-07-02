import type { AgentConfig } from "./config.ts";

export type PlaybackState = {
	title: string;
	mediaType: "movie" | "tv";
	progress: number;
	season?: number;
	episode?: number;
	durationMs?: number;
	positionMs?: number;
	externalId: string;
};

export async function postScrobbleEvent(
	config: AgentConfig,
	event: "playback" | "stop" | "scrobble",
	state: PlaybackState,
): Promise<{ ok: boolean; status: number }> {
	const base = config.endpoint.replace(/\/$/, "");
	const url = `${base}/api/webhook/scrobble/${config.token}`;
	const body = JSON.stringify({
		event: event === "scrobble" ? "scrobble" : event,
		title: state.title,
		mediaType: state.mediaType,
		season: state.season,
		episode: state.episode,
		progress: state.progress,
		durationMs: state.durationMs,
		positionMs: state.positionMs,
		externalId: `${state.externalId}:${event}`,
	});
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body,
	});
	return { ok: res.ok, status: res.status };
}

export async function testWebhook(config: AgentConfig): Promise<{
	ok: boolean;
	message: string;
}> {
	if (!config.token.trim()) {
		return { ok: false, message: "Webhook token is required" };
	}
	const result = await postScrobbleEvent(
		config,
		"scrobble",
		{
			title: "Agent Test",
			mediaType: "movie",
			progress: 100,
			externalId: `test-${Date.now()}`,
		},
	);
	if (result.status === 404) {
		return { ok: false, message: "Invalid token — check Connected services in WMTW" };
	}
	if (!result.ok) {
		return { ok: false, message: `Webhook returned ${result.status}` };
	}
	return { ok: true, message: "Test event sent successfully" };
}