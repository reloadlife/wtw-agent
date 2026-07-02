import { homedir } from "node:os";
import { join } from "node:path";

export type AgentConfig = {
	endpoint: string;
	token: string;
	mpvSocket: string;
	pollIntervalMs: number;
};

const CONFIG_DIR = join(homedir(), ".config", "wmtw-agent");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export const DEFAULT_CONFIG: AgentConfig = {
	endpoint: "https://whattowatch.app",
	token: "",
	mpvSocket: join(homedir(), ".config", "mpv", "socket"),
	pollIntervalMs: 15_000,
};

export function configPath(): string {
	return CONFIG_PATH;
}

export async function loadConfig(): Promise<AgentConfig> {
	try {
		const file = Bun.file(CONFIG_PATH);
		if (!(await file.exists())) return { ...DEFAULT_CONFIG };
		const parsed = (await file.json()) as Partial<AgentConfig>;
		return { ...DEFAULT_CONFIG, ...parsed };
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

export async function saveConfig(config: AgentConfig): Promise<void> {
	await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));
}