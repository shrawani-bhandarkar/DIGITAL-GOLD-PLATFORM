const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const configPath = resolve(__dirname, "..", "mcp.json");
const server = JSON.parse(readFileSync(configPath, "utf8")).servers?.["mcp-mysql"];

if (!server?.command || !Array.isArray(server.args) || !server.env) {
  process.stderr.write("mcp-mysql configuration is incomplete.\n");
  process.exit(1);
}

const child = spawn(server.command, server.args, {
  env: { ...process.env, ...server.env },
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("error", (error) => {
  process.stderr.write(`Could not start mcp-mysql: ${error.message}\n`);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}