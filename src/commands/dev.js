/**
 * Development server command for local function execution
 * 
 * This command runs a local development server that simulates the workerd runtime
 * environment, allowing you to test your Glia Functions locally before deployment.
 */

import path from 'path';
import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { Miniflare } from 'miniflare';
import BaseCommand from '../cli/base-command.js';
import { getApiConfig } from '../lib/config.js';
import { showInfo, showSuccess, showError, showWarning } from '../cli/error-handler.js';
import { watchFile } from 'fs';

// Create test page HTML - must use a function to avoid parsing issues
function createTestPageHtml(port, initialEnvironment = {}) {
  // Convert environment to JSON string for initial display
  const initialEnvJson = JSON.stringify(initialEnvironment, null, 2);

  const lines = [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<title>Glia Functions Tester</title>',
    '<style>',
    'body { font-family: sans-serif; margin: 20px; }',
    '.container { max-width: 800px; margin: 0 auto; }',
    '.tabs { display: flex; margin-bottom: 10px; }',
    '.tab { padding: 10px 20px; cursor: pointer; border: 1px solid #ddd; border-bottom: none; border-radius: 4px 4px 0 0; }',
    '.tab.active { background-color: #f5f5f5; }',
    '.tab-content { display: none; border: 1px solid #ddd; padding: 15px; border-radius: 0 4px 4px 4px; }',
    '.tab-content.active { display: block; }',
    'textarea { width: 100%; height: 200px; font-family: monospace; }',
    'pre { background: #f5f5f5; padding: 10px; overflow: auto; max-height: 400px; font-family: monospace; }',
    '.flex-row { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }',
    '.flex-grow { flex-grow: 1; }',
    '.notification { background: #e2f2ff; color: #0066cc; padding: 10px; margin: 10px 0; border-radius: 4px; display: none; }',
    '.history-item { cursor: pointer; padding: 5px; border: 1px solid #eee; margin: 2px 0; }',
    '.history-item:hover { background-color: #f0f0f0; }',
    '.env-group { margin-bottom: 15px; }',
    '.env-row { display: flex; gap: 10px; margin-bottom: 5px; }',
    '.env-row input { flex-grow: 1; padding: 5px; }',
    '.btn { padding: 8px 16px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; }',
    '.btn:hover { background: #0052a3; }',
    '.btn-sm { padding: 5px 10px; font-size: 12px; }',
    '.btn-danger { background: #dc3545; }',
    '.btn-danger:hover { background: #bd2130; }',
    '</style>',
    '</head>',
    '<body>',
    '<div class="container">',
    '  <h1>Glia Functions Test UI</h1>',
    '  <div id="rebuild-notification" class="notification">',
    '    Function has been rebuilt! <a href="#" onclick="window.location.reload()">Reload page</a> to use the latest version.',
    '  </div>',
    '  ',
    '  <div class="tabs">',
    '    <div class="tab active" data-tab="request-tab">Request Builder</div>',
    '    <div class="tab" data-tab="env-tab">Environment Variables</div>',
    '    <div class="tab" data-tab="history-tab">Request History</div>',
    '    <div class="tab" data-tab="logs-tab">Logs</div>',
    '  </div>',
    '',
    '  <div id="request-tab" class="tab-content active">',
    '    <div class="flex-row">',
    '      <select id="method">',
    '        <option value="POST">POST</option>',
    '        <option value="GET">GET</option>',
    '        <option value="PUT">PUT</option>',
    '        <option value="DELETE">DELETE</option>',
    '      </select>',
    '      <input type="text" id="endpoint" value="/" class="flex-grow" placeholder="/endpoint-path" />',
    '      <button onclick="sendRequest()" class="btn">Send Request</button>',
    '    </div>',
    '    <div>',
    '      <h3>Request Payload</h3>',
    '      <textarea id="payload">{"key": "value"}</textarea>',
    '    </div>',
    '    <div>',
    '      <h3>Response</h3>',
    '      <pre id="response">Response will appear here</pre>',
    '    </div>',
    '  </div>',
    '',
    '  <div id="env-tab" class="tab-content">',
    '    <h3>Environment Variables</h3>',
    '    <p>These environment variables will be available to your function during execution.</p>',
    '    <div id="env-variables" class="env-group">',
    '      <!-- Environment variables will be added here -->',
    '    </div>',
    '    <div class="flex-row">',
    '      <button onclick="addEnvRow()" class="btn">Add Variable</button>',
    '      <button onclick="saveEnvironment()" class="btn">Save & Rebuild</button>',
    '    </div>',
    '  </div>',
    '',
    '  <div id="history-tab" class="tab-content">',
    '    <h3>Request History</h3>',
    '    <div id="history-list">',
    '      <!-- Request history items will be added here -->',
    '      <p>No requests yet. Send a request to add it to history.</p>',
    '    </div>',
    '  </div>',
    '',
    '  <div id="logs-tab" class="tab-content">',
    '    <h3>Console Logs</h3>',
    '    <div class="flex-row">',
    '      <button onclick="clearLogs()" class="btn btn-sm">Clear Logs</button>',
    '    </div>',
    '    <pre id="logs">Loading logs...</pre>',
    '  </div>',
    '</div>',
    '',
    '<script>',
    '  // Initial environment variables',
    '  let environment = ' + JSON.stringify(initialEnvJson) + ';',
    '  let requestHistory = [];',
    '',
    '  document.addEventListener("DOMContentLoaded", function() {',
    '    // Initialize tabs',
    '    setupTabs();',
    '    ',
    '    // Start polling',
    '    setInterval(pollLogs, 1000);',
    '    setInterval(checkForRebuild, 2000);',
    '    ',
    '    // Load environment variables',
    '    try {',
    '      const savedEnv = JSON.parse(' + JSON.stringify(initialEnvJson) + ');',
    '      updateEnvUI(savedEnv);',
    '    } catch (e) {',
    '      console.error("Error loading environment:", e);',
    '      updateEnvUI({});',
    '    }',
    '    ',
    '    // Load request history',
    '    try {',
    '      const savedHistory = localStorage.getItem("requestHistory");',
    '      if (savedHistory) {',
    '        requestHistory = JSON.parse(savedHistory);',
    '        updateHistoryUI();',
    '      }',
    '    } catch (e) {',
    '      console.error("Error loading history:", e);',
    '    }',
    '  });',
    '',
    '  function setupTabs() {',
    '    const tabs = document.querySelectorAll(".tab");',
    '    tabs.forEach(tab => {',
    '      tab.addEventListener("click", function() {',
    '        // Remove active class from all tabs and content',
    '        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));',
    '        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));',
    '        ',
    '        // Add active class to clicked tab',
    '        this.classList.add("active");',
    '        ',
    '        // Show corresponding content',
    '        const tabId = this.getAttribute("data-tab");',
    '        document.getElementById(tabId).classList.add("active");',
    '      });',
    '    });',
    '  }',
    '',
    '  function sendRequest() {',
    '    const method = document.getElementById("method").value;',
    '    const endpoint = document.getElementById("endpoint").value;',
    '    const payload = document.getElementById("payload").value;',
    '    ',
    '    // Build URL - hardcoded to the same origin',
    '    const base = location.protocol + "//" + location.host;',
    '    const url = endpoint.startsWith("/") ? base + endpoint : base + "/" + endpoint;',
    '    ',
    '    // Send request',
    '    const options = { ',
    '      method: method,',
    '      headers: {"Content-Type": "application/json"}',
    '    };',
    '    ',
    '    // Add body for non-GET requests',
    '    if (method !== "GET" && method !== "HEAD") {',
    '      options.body = payload;',
    '    }',
    '    ',
    '    // Store request details for history',
    '    const requestData = {',
    '      timestamp: new Date().toISOString(),',
    '      method,',
    '      endpoint,',
    '      payload',
    '    };',
    '    ',
    '    // Make request',
    '    fetch(url, options)',
    '      .then(response => response.text())',
    '      .then(text => {',
    '        // Format response',
    '        try {',
    '          const json = JSON.parse(text);',
    '          document.getElementById("response").textContent = JSON.stringify(json, null, 2);',
    '          requestData.response = json;',
    '        } catch (e) {',
    '          document.getElementById("response").textContent = text;',
    '          requestData.response = text;',
    '        }',
    '        ',
    '        // Add to history',
    '        addToHistory(requestData);',
    '      })',
    '      .catch(error => {',
    '        document.getElementById("response").textContent = "Error: " + error.message;',
    '        requestData.error = error.message;',
    '        addToHistory(requestData);',
    '      });',
    '  }',
    '  ',
    '  function addToHistory(requestData) {',
    '    requestHistory.unshift(requestData);',
    '    if (requestHistory.length > 10) {',
    '      requestHistory.pop();',
    '    }',
    '    localStorage.setItem("requestHistory", JSON.stringify(requestHistory));',
    '    updateHistoryUI();',
    '  }',
    '  ',
    '  function updateHistoryUI() {',
    '    const historyList = document.getElementById("history-list");',
    '    if (requestHistory.length === 0) {',
    '      historyList.innerHTML = "<p>No requests yet. Send a request to add it to history.</p>";',
    '      return;',
    '    }',
    '    ',
    '    historyList.innerHTML = "";',
    '    requestHistory.forEach((item, index) => {',
    '      const historyItem = document.createElement("div");',
    '      historyItem.className = "history-item";',
    '      historyItem.onclick = () => loadHistoryItem(index);',
    '      ',
    '      const time = new Date(item.timestamp).toLocaleTimeString();',
    '      historyItem.textContent = `${time} - ${item.method} ${item.endpoint}`;',
    '      historyList.appendChild(historyItem);',
    '    });',
    '  }',
    '  ',
    '  function loadHistoryItem(index) {',
    '    const item = requestHistory[index];',
    '    document.getElementById("method").value = item.method;',
    '    document.getElementById("endpoint").value = item.endpoint;',
    '    document.getElementById("payload").value = item.payload;',
    '    ',
    '    // Switch to request tab',
    '    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));',
    '    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));',
    '    document.querySelector(\'[data-tab="request-tab"]\').classList.add("active");',
    '    document.getElementById("request-tab").classList.add("active");',
    '  }',
    '  ',
    '  function pollLogs() {',
    '    fetch("/__logs")',
    '      .then(response => response.json())',
    '      .then(data => {',
    '        if (data && data.logs) {',
    '          const logsEl = document.getElementById("logs");',
    '          logsEl.textContent = data.logs.join("\\n");',
    '          ',
    '          // Auto-scroll to bottom if already at bottom',
    '          if (logsEl.scrollTop + logsEl.clientHeight >= logsEl.scrollHeight - 50) {',
    '            logsEl.scrollTop = logsEl.scrollHeight;',
    '          }',
    '        }',
    '      })',
    '      .catch(error => console.error("Error fetching logs:", error));',
    '  }',
    '  ',
    '  function checkForRebuild() {',
    '    fetch("/__status")',
    '      .then(response => response.json())',
    '      .then(data => {',
    '        if (data && data.rebuilding) {',
    '          document.getElementById("rebuild-notification").style.display = "block";',
    '        }',
    '      })',
    '      .catch(error => console.error("Error checking rebuild status:", error));',
    '  }',
    '  ',
    '  function clearLogs() {',
    '    fetch("/__logs/clear", { method: "POST" })',
    '      .then(() => {',
    '        document.getElementById("logs").textContent = "Logs cleared";',
    '      })',
    '      .catch(error => console.error("Error clearing logs:", error));',
    '  }',
    '  ',
    '  function updateEnvUI(envData) {',
    '    const envContainer = document.getElementById("env-variables");',
    '    envContainer.innerHTML = "";',
    '    ',
    '    // Create inputs for each env var',
    '    Object.entries(envData).forEach(([key, value]) => {',
    '      addEnvRow(key, value);',
    '    });',
    '    ',
    '    // Add an empty row if no variables',
    '    if (Object.keys(envData).length === 0) {',
    '      addEnvRow("", "");',
    '    }',
    '  }',
    '  ',
    '  function addEnvRow(key = "", value = "") {',
    '    const envContainer = document.getElementById("env-variables");',
    '    const row = document.createElement("div");',
    '    row.className = "env-row";',
    '    ',
    '    const keyInput = document.createElement("input");',
    '    keyInput.type = "text";',
    '    keyInput.placeholder = "Variable Name";',
    '    keyInput.value = key;',
    '    keyInput.className = "env-key";',
    '    ',
    '    const valueInput = document.createElement("input");',
    '    valueInput.type = "text";',
    '    valueInput.placeholder = "Value";',
    '    valueInput.value = value;',
    '    valueInput.className = "env-value";',
    '    ',
    '    const removeBtn = document.createElement("button");',
    '    removeBtn.textContent = "Remove";',
    '    removeBtn.className = "btn btn-sm btn-danger";',
    '    removeBtn.onclick = function() {',
    '      envContainer.removeChild(row);',
    '    };',
    '    ',
    '    row.appendChild(keyInput);',
    '    row.appendChild(valueInput);',
    '    row.appendChild(removeBtn);',
    '    envContainer.appendChild(row);',
    '  }',
    '  ',
    '  function saveEnvironment() {',
    '    const rows = document.querySelectorAll(".env-row");',
    '    const env = {};',
    '    ',
    '    rows.forEach(row => {',
    '      const key = row.querySelector(".env-key").value.trim();',
    '      const value = row.querySelector(".env-value").value;',
    '      ',
    '      if (key) {',
    '        env[key] = value;',
    '      }',
    '    });',
    '    ',
    '    // Save to server',
    '    fetch("/__env", {',
    '      method: "POST",',
    '      headers: { "Content-Type": "application/json" },',
    '      body: JSON.stringify(env)',
    '    })',
    '      .then(response => response.json())',
    '      .then(data => {',
    '        if (data.success) {',
    '          alert("Environment variables updated and function is rebuilding!");',
    '        } else {',
    '          alert("Error updating environment variables: " + data.error);',
    '        }',
    '      })',
    '      .catch(error => {',
    '        alert("Error saving environment: " + error.message);',
    '      });',
    '  }',
    '</script>',
    '</body>',
    '</html>',
  ];
  
  return lines.join('\n');
}

/**
 * Run a function locally in development mode
 * 
 * @param {Object} options - Command options
 * @param {string} options.path - Path to function file
 * @param {number} options.port - Port to run server on
 * @param {boolean} options.watch - Whether to watch for file changes
 * @param {Object} options.env - Environment variables to pass to function
 * @param {string} options.profile - Profile to use for configuration
 * @returns {Promise<Object>} - Server information
 */
export async function dev(options = {}) {
  try {
    // Validate path
    if (!options.path) {
      throw new Error('Function path is required');
    }
    
    const functionPath = path.resolve(options.path);
    if (!fs.existsSync(functionPath)) {
      throw new Error(`Function file not found: ${functionPath}`);
    }
    
    // Set default port
    const port = options.port || 8787;
    
    // Store console logs to display in the UI
    const logs = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;
    
    // Track rebuilding state
    let isRebuilding = false;
    let buildCompletedAt = null;
    
    // Wrap console methods to capture logs
    function wrapConsole() {
      console.log = (...args) => {
        originalConsoleLog(...args);
        logs.push(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        if (logs.length > 1000) logs.shift(); // Limit log size
      };
      
      console.error = (...args) => {
        originalConsoleError(...args);
        logs.push(`[ERROR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        if (logs.length > 1000) logs.shift();
      };
      
      console.warn = (...args) => {
        originalConsoleWarn(...args);
        logs.push(`[WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        if (logs.length > 1000) logs.shift();
      };
      
      console.info = (...args) => {
        originalConsoleInfo(...args);
        logs.push(`[INFO] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        if (logs.length > 1000) logs.shift();
      };
    }
    
    // Restore original console methods
    function restoreConsole() {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
    }
    
    // Function to build and update the function code
    async function buildFunction() {
      isRebuilding = true;
      
      showInfo(`Building function from ${path.basename(functionPath)}...`);
      
      // Build the function using esbuild
      const outputPath = path.resolve(process.cwd(), 'function-out.js');
      
      // Use npm script to run esbuild (more reliable than direct binary access)
      const buildArgs = [
        'run',
        'build',
        '--',
        options.path
      ];
      
      return new Promise((resolve, reject) => {
        // Start build process
        const buildProcess = spawn('npm', buildArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        
        const buildOutput = [];
        
        // Handle build output
        buildProcess.stdout.on('data', (data) => {
          const output = data.toString();
          console.log(`[esbuild] ${output}`);
          buildOutput.push(`[esbuild] ${output}`);
        });
        
        buildProcess.stderr.on('data', (data) => {
          const output = data.toString();
          console.error(`[esbuild] ${output}`);
          buildOutput.push(`[esbuild error] ${output}`);
        });
        
        buildProcess.on('close', (code) => {
          isRebuilding = false;
          buildCompletedAt = Date.now();
          
          if (code === 0) {
            console.log(`Build completed successfully`);
            resolve(outputPath);
          } else {
            const error = new Error(`Build failed with exit code ${code}`);
            console.error(error.message);
            reject(error);
          }
        });
        
        buildProcess.on('error', (error) => {
          isRebuilding = false;
          console.error(`Build error: ${error.message}`);
          reject(error);
        });
      });
    }
    
    // Wrap console methods
    wrapConsole();
    
    // Build the function initially
    const outputPath = await buildFunction();
    
    if (!fs.existsSync(outputPath)) {
      restoreConsole();
      throw new Error(`Build failed: Function output file not created`);
    }
    
    // Load API config for environment variables
    const apiConfig = await getApiConfig(options.profile);
    
    // Create environment variables
    const env = {
      ...apiConfig,
      ...(options.env || {}),
    };
    
    // Create mock invoker data for testing
    const mockInvoker = {
      type: 'development',
      id: 'local-dev-server',
      timestamp: new Date().toISOString()
    };
    
    showInfo(`Starting local development server on port ${port}...`);
    
    // Create service worker script that doesn't use import
    let functionCode = await fs.promises.readFile(outputPath, 'utf8');
    
    // Cache the HTML to avoid recreating it for every request
    const testPageHtml = createTestPageHtml(port, env);
    
    // Create service worker script with test HTML directly inside 
    const createWorkerScript = (functionCode) => `
// Service Worker entry point
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

// Save log references
globalThis._logs = [];
globalThis._env = ${JSON.stringify(env)};
globalThis._rebuilding = false;
globalThis.self = globalThis; // Provide window/self for compatibility
globalThis.window = globalThis; // Add window global for browser APIs
globalThis._version = "${Date.now()}";

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Override console methods to capture logs
console.log = (...args) => {
  originalConsoleLog(...args);
  globalThis._logs.push('[LOG] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
  if (globalThis._logs.length > 1000) globalThis._logs.shift();
};

console.error = (...args) => {
  originalConsoleError(...args);
  globalThis._logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
  if (globalThis._logs.length > 1000) globalThis._logs.shift();
};

console.warn = (...args) => {
  originalConsoleWarn(...args);
  globalThis._logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
  if (globalThis._logs.length > 1000) globalThis._logs.shift();
};

console.info = (...args) => {
  originalConsoleInfo(...args);
  globalThis._logs.push('[INFO] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
  if (globalThis._logs.length > 1000) globalThis._logs.shift();
};

// Helper functions
function sanitizeJson(str) {
  if (!str) return "{}";
  try {
    // Test if it's valid JSON
    JSON.parse(str);
    return str;
  } catch (e) {
    console.warn("Invalid JSON, sanitizing:", e.message);
    return "{}";
  }
}

// Special route handler
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Special routes for dev server
  
  // Endpoint for logs
  if (url.pathname === '/__logs') {
    return new Response(JSON.stringify({ logs: globalThis._logs }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Endpoint to clear logs
  if (url.pathname === '/__logs/clear' && request.method === 'POST') {
    globalThis._logs = [];
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Endpoint for rebuild status
  if (url.pathname === '/__status') {
    return new Response(JSON.stringify({ 
      rebuilding: globalThis._rebuilding || false,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Endpoint for environment variables
  if (url.pathname === '/__env') {
    if (request.method === 'GET') {
      return new Response(JSON.stringify(globalThis._env || {}), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (request.method === 'POST') {
      try {
        const data = await request.json();
        // We're just forwarding the request to Node.js server
        // The actual environment will be updated there
        return new Response(JSON.stringify({ 
          success: true, 
          env: data,
          message: "Environment variables received. Function rebuilding."
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
  
  // UI for root path
  if (request.method === 'GET' && url.pathname === '/') {
    // Define test page HTML statically
    const html = ${JSON.stringify(testPageHtml)};
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  try {
    // Log incoming request
    console.log(\`\${request.method} \${url.pathname}\`);
    
    // Create mock invoker
    const mockInvoker = {
      type: 'development',
      id: 'local-dev-server',
      timestamp: new Date().toISOString()
    };
    
    // Log start time
    console.log('Invoking function...');
    const startTime = Date.now();
    
    // Handle request differently based on method
    let gliaResponse;
    
    if (request.method === 'GET' || request.method === 'HEAD') {
      // For GET/HEAD requests, we can't add a body, so create a POST clone
      const postClone = new Request(request.url, {
        method: 'POST', 
        headers: request.headers,
        body: JSON.stringify({
          invoker: mockInvoker,
          payload: "{}"
        })
      });
      
      // Call onInvoke with the POST clone
      gliaResponse = await onInvoke(postClone, globalThis);
    } else {
      // For other methods, process normally
      let requestBody = "{}";
      try {
        const bodyText = await request.text();
        if (bodyText) {
          // Test parsing but use original text
          JSON.parse(bodyText);
          requestBody = bodyText;
        }
      } catch (e) {
        console.warn('Error parsing request body:', e.message);
      }
      
      // Create Glia-compatible request
      const gliaRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify({
          invoker: mockInvoker,
          payload: requestBody
        })
      });
      
      // Call the function with our request
      gliaResponse = await onInvoke(gliaRequest, globalThis);
    }
    
    // Function execution is done
    console.log(\`Function executed in \${Date.now() - startTime}ms\`);
    return gliaResponse;
  } catch (error) {
    console.error('Error executing function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error',
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Include the bundled function code
${functionCode}
`;

    // Store logs in global scope
    global._logs = logs;
    
    // Generate the initial worker script
    let workerScript = createWorkerScript(functionCode);
    let mf = null;
    
    // Function to initialize or reinitialize Miniflare
    async function initializeMiniflare(script) {
      // If Miniflare instance exists, dispose of it
      if (mf) {
        await mf.dispose();
      }
      
      // Create a new Miniflare instance
      mf = new Miniflare({
        modules: true,
        script,
        bindings: env
      });
      
      // Set rebuilding flag to false in the worker
      try {
        const context = await mf.getGlobalScope();
        context._rebuilding = false;
      } catch (error) {
        console.error('Failed to set rebuilding flag:', error);
      }
      
      return mf;
    }
    
    // Initialize Miniflare with the worker script
    mf = await initializeMiniflare(workerScript);
    
    // Function to update the worker code
    async function updateWorker() {
      try {
        // Set rebuilding flag in the worker
        if (mf) {
          try {
            const context = await mf.getGlobalScope();
            context._rebuilding = true;
          } catch (error) {
            console.error('Failed to set rebuilding flag:', error);
          }
        }
        
        // Get the latest function code
        const newFunctionCode = await fs.promises.readFile(outputPath, 'utf8');
        
        // Generate a new worker script
        workerScript = createWorkerScript(newFunctionCode);
        
        // Reinitialize Miniflare with the new worker script
        await initializeMiniflare(workerScript);
        
        showSuccess('Worker script updated successfully');
      } catch (error) {
        showError(`Failed to update worker: ${error.message}`);
      }
    }
    
    // Set up file watcher if enabled
    if (options.watch) {
      showInfo(`Watching ${path.basename(functionPath)} for changes...`);
      
      // Watch the function file
      watchFile(functionPath, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          showInfo(`Function file changed. Rebuilding...`);
          try {
            isRebuilding = true;
            await buildFunction();
            await updateWorker();
            showSuccess('Function rebuilt and reloaded');
          } catch (error) {
            showError(`Failed to rebuild function: ${error.message}`);
          }
        }
      });
    }
    
    // Create HTTP server to handle requests
    const server = http.createServer(async (req, res) => {
      try {
        // Convert Node.js request to Fetch Request
        const url = new URL(req.url, `http://localhost:${port}`);
        
        // Handle environment updates
        if (url.pathname === '/__env' && req.method === 'POST') {
          // Read request body
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const body = Buffer.concat(chunks).toString();
          
          try {
            // Parse environment variables
            const newEnv = JSON.parse(body);
            
            // Update environment
            Object.assign(env, newEnv);
            
            // Rebuild function with new environment
            showInfo('Updating environment variables and rebuilding...');
            await buildFunction();
            await updateWorker();
            
            // Send success response
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              success: true, 
              message: 'Environment variables updated' 
            }));
            return;
          } catch (error) {
            // Send error response
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              success: false, 
              error: error.message || 'Failed to update environment variables' 
            }));
            return;
          }
        }
        
        // Handle logs/clear endpoint directly
        if (url.pathname === '/__logs/clear' && req.method === 'POST') {
          logs.length = 0; // Clear logs array
          global._logs = logs;
          
          // Update logs in worker
          if (mf) {
            try {
              const context = await mf.getGlobalScope();
              context._logs = [];
            } catch (error) {
              console.error('Failed to clear logs in worker:', error);
            }
          }
          
          // Send success response
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }
        
        // Handle status endpoint directly
        if (url.pathname === '/__status') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
            rebuilding: isRebuilding,
            buildCompletedAt,
            timestamp: Date.now()
          }));
          return;
        }
        
        // Collect request body if present for other endpoints
        let body = null;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks).toString();
        }
        
        // Create a Fetch API Request from the Node.js request
        const fetchRequest = new Request(url, {
          method: req.method,
          headers: req.headers,
          body: body || undefined
        });
        
        // Handle request with Miniflare
        const fetchResponse = await mf.dispatchFetch(url.toString(), fetchRequest);
        
        // Convert Fetch Response to Node.js response
        res.statusCode = fetchResponse.status;
        
        // Set response headers
        for (const [key, value] of fetchResponse.headers.entries()) {
          res.setHeader(key, value);
        }
        
        // Send response body
        const responseBody = await fetchResponse.arrayBuffer();
        res.end(Buffer.from(responseBody));
      } catch (error) {
        // Handle errors
        console.error('Server error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message || 'Internal Server Error' }));
      }
    });
    
    try {
      // Start the HTTP server
      await new Promise((resolve, reject) => {
        server.listen(port, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      showSuccess(`\n🚀 Development server running at http://localhost:${port}`);
      showInfo(`Open http://localhost:${port} in your browser to test your function.`);
      
      if (options.watch) {
        showInfo(`Watching for changes to ${path.basename(functionPath)}`);
      } else {
        showInfo(`Hot reloading is disabled. Use --watch flag to enable.`);
      }
    } catch (err) {
      showError(`Failed to start server: ${err.message}`);
      throw err;
    }
    
    // Add event listeners to handle process exit
    process.on('SIGINT', () => {
      showInfo('Shutting down development server...');
      server.close();
      if (mf) mf.dispose(); // Clean up miniflare
      restoreConsole();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      showInfo('Shutting down development server...');
      server.close();
      if (mf) mf.dispose(); // Clean up miniflare
      restoreConsole();
      process.exit(0);
    });
    
    return {
      url: `http://localhost:${port}`,
      port,
      functionPath,
      outputPath,
      env: Object.keys(env).length
    };
  } catch (error) {
    console.error(`Failed to start development server:`, error);
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
function main() {
  const command = new BaseCommand('dev', 'Run function locally in development mode')
    .option('--path <path>', 'Path to function file')
    .option('--port <port>', 'Port to run server on', '8787')
    .option('--watch', 'Watch for file changes and rebuild', false)
    .option('--env <json>', 'Environment variables as JSON string', '{}')
    .option('--profile <n>', 'Profile to use for environment variables')
    .action(async (options) => {
      try {
        // Parse environment variables
        let env = {};
        if (options.env && options.env !== '{}') {
          try {
            env = JSON.parse(options.env);
          } catch (error) {
            showError(`Invalid environment variables JSON: ${error.message}`);
            process.exit(1);
          }
        }
        
        // Start development server
        await dev({
          path: options.path,
          port: parseInt(options.port, 10) || 8787,
          watch: options.watch,
          env,
          profile: options.profile
        });
        
        // Keep the process running
        process.stdin.resume();
      } catch (error) {
        showError(`Development server error: ${error.message}`);
        process.exit(1);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1])) {
  main();
}

export default dev;