const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

let electronProcess = null;

function startElectron() {
  if (electronProcess) {
    electronProcess.kill();
  }

  console.log("Starting Electron...");
  electronProcess = spawn("npx", ["electron", "dist-electron/electron.js"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });

  electronProcess.on("close", (code) => {
    if (code !== null) {
      console.log(`Electron process exited with code ${code}`);
    }
  });
}

function compileElectron() {
  console.log("Compiling Electron main process...");
  const tsc = spawn("npx", ["tsc", "-p", "tsconfig.electron.json"], {
    stdio: "inherit",
  });

  tsc.on("close", (code) => {
    if (code === 0) {
      console.log("Electron compilation completed");
      startElectron();
    } else {
      console.error("Electron compilation failed");
    }
  });
}

// Watch for changes to electron.ts
fs.watchFile("electron.ts", { interval: 1000 }, (curr, prev) => {
  console.log("Electron main process file changed, recompiling...");
  compileElectron();
});

// Initial compilation and start
compileElectron();

// Handle graceful shutdown
process.on("SIGINT", () => {
  if (electronProcess) {
    electronProcess.kill();
  }
  process.exit(0);
});
