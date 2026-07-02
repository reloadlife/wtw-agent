import { Webview } from "webview-bun";

const PORT = 38472;

const worker = new Worker(new URL("./worker.ts", import.meta.url).href, {
	type: "module",
});

// Brief delay so the worker's Bun.serve is ready before the webview loads.
await Bun.sleep(300);

const webview = new Webview();
webview.title("WhatToWatch Agent");
webview.size(520, 640);
webview.navigate(`http://127.0.0.1:${PORT}/`);
webview.run();

worker.terminate();