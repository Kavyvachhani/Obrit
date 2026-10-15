const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");

let mainWindow = null;
let serverStarted = false;

function startBackend() {
  if (serverStarted) return;
  serverStarted = true;
  try {
    // Require and start the internal backend server bundle
    process.env.PORT = "4000";
    process.env.HOST = "127.0.0.1";
    process.env.NODE_ENV = "production";
    require("./server-bundle.cjs");
    console.log("Internal Orbit backend initialized.");
  } catch (err) {
    console.error("Failed to start embedded backend:", err);
  }
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve) => {
    function check() {
      http
        .get(url, (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            retry();
          }
        })
        .on("error", () => {
          retry();
        });
    }

    function retry() {
      if (Date.now() - start > timeoutMs) {
        resolve(false);
      } else {
        setTimeout(check, 250);
      }
    }

    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#060911",
    title: "Orbit — Live 3D AWS Infrastructure Explorer",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  startBackend();

  // Wait for Fastify to be ready on port 4000
  const isReady = await waitForServer("http://127.0.0.1:4000/api/health", 10000);
  if (isReady) {
    await mainWindow.loadURL("http://127.0.0.1:4000");
  } else {
    // Direct file fallback
    const indexPath = path.join(__dirname, "public", "index.html");
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

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
