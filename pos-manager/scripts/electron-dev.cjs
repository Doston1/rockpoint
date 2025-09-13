const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

let electronProcess = null;

function startElectron() {
  if (electronProcess) {
    electronProcess.kill();
  }

  console.log("Starting Electron...");
  electronProcess = spawn(
    "cmd",
    ["/c", "npx", "electron", "dist-electron/electron.cjs"],
    {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "development" },
    }
  );

  electronProcess.on("close", (code) => {
    if (code !== null) {
      console.log(`Electron process exited with code ${code}`);
    }
  });
}

function compileElectron() {
  console.log("Compiling Electron main process...");
  const tsc = spawn(
    "cmd",
    ["/c", "npx", "tsc", "-p", "tsconfig.electron.json"],
    { stdio: "inherit" }
  );

  tsc.on("close", (code) => {
    if (code === 0) {
      // Rename the compiled .js file to .cjs
      const fs = require("fs");
      const jsPath = "dist-electron/electron.js";
      const cjsPath = "dist-electron/electron.cjs";

      if (fs.existsSync(jsPath)) {
        fs.renameSync(jsPath, cjsPath);
        console.log("Renamed electron.js to electron.cjs");
      }

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
