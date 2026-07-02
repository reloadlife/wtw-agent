import { existsSync } from "node:fs";

export type MpvState = {
	idle: boolean;
	title: string;
	percent: number;
	durationMs: number;
	positionMs: number;
	filename: string;
};

function mpvCommand(socketPath: string, command: unknown[]): Promise<unknown> {
	return new Promise((resolve, reject) => {
		let buffer = "";
		const conn = Bun.connect({
			unix: socketPath,
			socket: {
				open(socket) {
					socket.write(`${JSON.stringify({ command })}\n`);
				},
				data(_socket, data) {
					buffer += new TextDecoder().decode(data);
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							resolve(JSON.parse(line));
							conn.end();
						} catch {
							// wait for full line
						}
					}
				},
				error(_socket, err) {
					reject(err);
				},
			},
		});
		setTimeout(() => {
			reject(new Error("MPV socket timeout"));
			conn.end();
		}, 2000);
	});
}

async function getProperty(socketPath: string, name: string): Promise<unknown> {
	const res = (await mpvCommand(socketPath, ["get_property", name])) as {
		data?: unknown;
		error?: string;
	};
	if (res?.error) throw new Error(res.error);
	return res?.data;
}

export function mpvSocketAvailable(socketPath: string): boolean {
	return existsSync(socketPath);
}

export async function readMpvState(socketPath: string): Promise<MpvState | null> {
	if (!mpvSocketAvailable(socketPath)) return null;
	try {
		const idle = Boolean(await getProperty(socketPath, "idle-active"));
		const title = String((await getProperty(socketPath, "media-title")) ?? "");
		const percent = Number((await getProperty(socketPath, "percent-pos")) ?? 0);
		const duration = Number((await getProperty(socketPath, "duration")) ?? 0);
		const position = Number((await getProperty(socketPath, "time-pos")) ?? 0);
		const filename = String((await getProperty(socketPath, "filename")) ?? "");
		return {
			idle,
			title: title || filename || "Unknown",
			percent: Number.isFinite(percent) ? percent : 0,
			durationMs: duration > 0 ? Math.round(duration * 1000) : 0,
			positionMs: position > 0 ? Math.round(position * 1000) : 0,
			filename,
		};
	} catch {
		return null;
	}
}

/** Guess TV episode from filename like S01E02 or 1x02 */
export function parseEpisodeFromFilename(
	name: string,
): { season?: number; episode?: number } {
	const sxxexx = name.match(/[Ss](\d{1,2})[Ee](\d{1,2})/);
	if (sxxexx) {
		return { season: Number(sxxexx[1]), episode: Number(sxxexx[2]) };
	}
	const alt = name.match(/(\d{1,2})x(\d{1,2})/);
	if (alt) {
		return { season: Number(alt[1]), episode: Number(alt[2]) };
	}
	return {};
}

export function guessMediaType(name: string): "movie" | "tv" {
	const ep = parseEpisodeFromFilename(name);
	return ep.season !== undefined ? "tv" : "movie";
}