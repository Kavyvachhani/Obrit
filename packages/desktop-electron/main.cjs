const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// Ensure environment variables are set before anything else
process.env.ORBIT_DESKTOP = "true";
process.env.PORT = "4000";
process.env.HOST = "127.0.0.1";
process.env.NODE_ENV = "production";

let mainWindow = null;
let serverStarted = false;

// Global error handlers to prevent silent crashes
function writeCrashLog(prefix, err) {
  try {
    const dir = app.isReady() ? app.getPath("userData") : __dirname;
    const logFile = path.join(dir, "orbit-debug.log");
    const msg = `[${new Date().toISOString()}] ${prefix}: ${err?.stack || err}\n`;
    fs.appendFileSync(logFile, msg, "utf8");
    console.error(prefix, err);
  } catch (_) {}
}

process.on("uncaughtException", (err) => {
  writeCrashLog("UncaughtException", err);
});

process.on("unhandledRejection", (reason) => {
  writeCrashLog("UnhandledRejection", reason);
});

function startBackend() {
  if (serverStarted) return;
  serverStarted = true;
  try {
    require("./server-bundle.cjs");
    console.log("Internal Orbit backend initialized.");
  } catch (err) {
    writeCrashLog("EmbeddedBackendError", err);
  }
}

function waitForServer(url, timeoutMs = 4000) {
  const start = Date.now();
  return new Promise((resolve) => {
    function check() {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on("error", () => {
        retry();
      });
      req.setTimeout(500, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - start > timeoutMs) {
        resolve(false);
      } else {
        setTimeout(check, 200);
      }
    }

    check();
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  async function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      backgroundColor: "#060911",
      title: "Orbit — Live 3D AWS Infrastructure Explorer",
      autoHideMenuBar: true,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: false,
      },
    });

    // Bring to front
    mainWindow.show();
    mainWindow.focus();

    // 3. Fallback on load failure
    const fallbackIndexPath = path.join(__dirname, "public", "index.html");
    mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
      console.warn("loadURL failed, using fallback index.html:", errorCode, errorDescription);
      if (fs.existsSync(fallbackIndexPath) && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(fallbackIndexPath).catch((e) => console.error("loadFile failed:", e));
      }
    });

    // 4. Start the backend
    startBackend();

    // 5. Check if local backend is responsive, otherwise load bundled static frontend
    const isReady = await waitForServer("http://127.0.0.1:4000/api/health", 2500);
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (isReady) {
      mainWindow.loadURL("http://127.0.0.1:4000").catch(() => {
        if (fs.existsSync(fallbackIndexPath) && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadFile(fallbackIndexPath);
        }
      });
    } else {
      if (fs.existsSync(fallbackIndexPath)) {
        mainWindow.loadFile(fallbackIndexPath);
      }
    }

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
