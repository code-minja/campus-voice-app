const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const [nodeMajor, nodeMinor] = process.versions.node
  .split(".")
  .map(Number);
const supportedNodeVersion =
  (nodeMajor === 22 && nodeMinor >= 13) ||
  (nodeMajor === 24 && nodeMinor >= 3) ||
  nodeMajor >= 26;
if (!supportedNodeVersion) {
  console.error(
    `[CampusVoice] Node.js ^22.13.0, ^24.3.0, ^26.0.0, or >=27.0.0 is required by Expo SDK 58; found ${process.versions.node}. Please upgrade Node.js and retry.`
  );
  process.exit(1);
}

// 1. Detect the local network IP address on the active interface
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const addresses = interfaces[interfaceName];
    for (const address of addresses) {
      // Find the first IPv4 address that is not loopback
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return "127.0.0.1";
}

const localIp = getLocalIpAddress();
console.log(`\n🔍 [CampusVoice] Detected local network IP: ${localIp}`);

// 2. Check if Docker daemon is running
let useDocker = false;
try {
  // Silent check if docker is responsive
  execSync("docker info", { stdio: "ignore" });
  useDocker = true;
  console.log("🐳 [CampusVoice] Docker daemon detected. Running backend in Docker container.");
} catch (e) {
  console.log("⚠️  [CampusVoice] Docker daemon is not running or docker command not found.");
  console.log("👉 [CampusVoice] Falling back to local virtualenv server...");
}

const targetPort = useDocker ? 8001 : 8000;
const newApiLine = `EXPO_PUBLIC_API_BASE_URL=http://${localIp}:${targetPort}`;

// 3. Read and update the .env file in the React Native project
const envPath = path.join(__dirname, "../.env");
let envContent = "";
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, "utf8");
}

if (envContent.includes("EXPO_PUBLIC_API_BASE_URL=")) {
  // Regex to replace the EXPO_PUBLIC_API_BASE_URL value, supporting comments and empty values
  envContent = envContent.replace(
    /EXPO_PUBLIC_API_BASE_URL=http[s]?:\/\/[^\s#\n\r]+/g,
    newApiLine
  );
} else {
  envContent += `\n${newApiLine}\n`;
}

fs.writeFileSync(envPath, envContent, "utf8");
console.log(`✅ [CampusVoice] Updated .env file with current IP base URL: ${newApiLine}`);

// 4. Start the Backend (Docker or local virtualenv)
const backendPath = path.resolve(__dirname, "../../campus-voice");
let backendProcess;

if (!fs.existsSync(backendPath)) {
  console.error(`[CampusVoice] Backend directory not found: ${backendPath}`);
  process.exit(1);
}

if (useDocker) {
  console.log(`🚀 [CampusVoice] Starting Docker Compose backend on port ${targetPort}...`);
  backendProcess = spawn(
    "docker",
    ["compose", "--profile", "dev", "up", "campus-voice-dev"],
    {
      cwd: backendPath,
      stdio: "inherit"
    }
  );
} else {
  const pythonBin = path.join(
    backendPath,
    ".venv",
    process.platform === "win32" ? "Scripts" : "bin",
    process.platform === "win32" ? "python.exe" : "python"
  );
  if (!fs.existsSync(pythonBin)) {
    console.error(`[CampusVoice] Python virtual environment not found: ${pythonBin}`);
    console.error(`[CampusVoice] Run "uv sync" in ${backendPath}, then retry "npm run dev".`);
    process.exit(1);
  }

  console.log(`🚀 [CampusVoice] Starting local virtualenv backend on port ${targetPort}...`);
  backendProcess = spawn(
    pythonBin,
    ["-m", "uvicorn", "campus_voice.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
    {
      cwd: backendPath,
      stdio: "inherit",
      env: process.env
    }
  );
}

backendProcess.on("error", (error) => {
  console.error(`[CampusVoice] Could not start the backend: ${error.message}`);
});

// 5. Start the Expo Metro Bundler
console.log("🚀 [CampusVoice] Starting Expo Metro Bundler...");
const expoProcess = spawn("npx", ["expo", "start", "-c"], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  shell: true,
});

expoProcess.on("error", (error) => {
  console.error(`[CampusVoice] Could not start Expo: ${error.message}`);
});

// Handle graceful termination of child processes
process.on("SIGINT", () => {
  console.log("\n🛑 [CampusVoice] Shutting down all services...");
  backendProcess.kill("SIGINT");
  expoProcess.kill("SIGINT");
  process.exit();
});
