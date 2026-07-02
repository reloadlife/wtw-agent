#!/usr/bin/env bun
/**
 * Cross-compile WMTW Agent for all major desktop targets.
 * Run on macOS to produce darwin + linux + windows binaries.
 */

import { mkdirSync } from "node:fs";

const targets = [
	{ target: "bun-darwin-arm64", out: "wmtw-agent-macos-arm64" },
	{ target: "bun-darwin-x64", out: "wmtw-agent-macos-x64" },
	{ target: "bun-linux-x64", out: "wmtw-agent-linux-x64" },
	{ target: "bun-linux-arm64", out: "wmtw-agent-linux-arm64" },
	{ target: "bun-windows-x64", out: "wmtw-agent-windows-x64.exe" },
] as const;

mkdirSync("dist", { recursive: true });

for (const { target, out } of targets) {
	console.log(`Building ${out} (${target})...`);
	const proc = Bun.spawnSync([
		"bun",
		"build",
		"--compile",
		"--minify",
		"--sourcemap",
		`--target=${target}`,
		"./src/index.ts",
		"./src/worker.ts",
		"--outfile",
		`dist/${out}`,
	]);
	if (proc.exitCode !== 0) {
		console.error(proc.stderr.toString());
		process.exit(proc.exitCode ?? 1);
	}
}

console.log("Done. Binaries in dist/");