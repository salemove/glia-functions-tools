/**
 * Create a test page for the Glia Functions local dev server
 * @param {number} port The port number the server is running on
 * @returns {string} HTML content for the test page
 */
export default function createTestPage(port) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Glia Functions Test UI</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #4a5568; }
    h2 { color: #6b7280; margin-top: 30px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .form-group { margin-bottom: 15px; }
    label { display: block; font-weight: 600; margin-bottom: 5px; color: #4a5568; }
    input, textarea, select { width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box; font-family: inherit; font-size: 14px; }
    textarea { min-height: 200px; font-family: monospace; }
    button { background: #4f46e5; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-weight: 600; }
    button:hover { background: #3730a3; }
    .result { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 15px; max-height: 400px; overflow: auto; font-family: monospace; white-space: pre-wrap; }
    .result-container { margin-top: 20px; }
    .tabs { display: flex; margin-bottom: -1px; }
    .tab { padding: 8px 16px; cursor: pointer; border: 1px solid transparent; }
    .tab.active { background: #fff; border: 1px solid #e2e8f0; border-bottom-color: #fff; border-top-left-radius: 4px; border-top-right-radius: 4px; }
    .request-method { display: inline-block; width: 100px; }
    .status { padding: 3px 6px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .status-success { background: #c6f6d5; color: #22543d; }
    .status-error { background: #fed7d7; color: #822727; }
    .history-item { padding: 10px; border-bottom: 1px solid #e2e8f0; cursor: pointer; }
    .history-item:hover { background: #f7fafc; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Glia Functions Development Server</h1>
    
    <div class="card">
      <div class="tabs">
        <div class="tab active" data-tab="request">Request Builder</div>
        <div class="tab" data-tab="history">Request History</div>
        <div class="tab" data-tab="logs">Logs</div>
      </div>
      
      <div class="tab-content" id="request-tab">
        <div class="form-group">
          <label for="method">Method</label>
          <select id="method">
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="endpoint">Endpoint</label>
          <input type="text" id="endpoint" value="/" />
        </div>
        
        <div class="form-group">
          <label for="payload">Request Payload (JSON)</label>
          <textarea id="payload">{\n  "key": "value"\n}</textarea>
        </div>
        
        <button id="send">Send Request</button>
        
        <div class="result-container">
          <label>Response</label>
          <div class="result" id="response"></div>
        </div>
      </div>
      
      <div class="tab-content hidden" id="history-tab">
        <div id="history-list"></div>
      </div>
      
      <div class="tab-content hidden" id="logs-tab">
        <div class="result" id="logs"></div>
      </div>
    </div>
  </div>
  
  <script>
    // Store request history
    const history = [];
    const logs = [];
    const serverPort = ${port};
    
    // Tabs functionality
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        document.getElementById(tabId + '-tab').classList.remove('hidden');
      });
    });
    
    // Send request
    document.getElementById('send').addEventListener('click', async () => {
      const method = document.getElementById('method').value;
      const endpoint = document.getElementById('endpoint').value;
      const payloadStr = document.getElementById('payload').value;
      
      try {
        // Validate JSON
        let payload;
        try {
          payload = JSON.parse(payloadStr);
        } catch (e) {
          alert('Invalid JSON payload');
          return;
        }
        
        // Use hardcoded URL with port number
        const url = endpoint.startsWith('/') 
          ? 'http://localhost:' + serverPort + endpoint 
          : 'http://localhost:' + serverPort + '/' + endpoint;
        
        const startTime = Date.now();
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: method !== 'GET' ? JSON.stringify(payload) : undefined
        });
        const duration = Date.now() - startTime;
        
        const responseData = await response.text();
        let formattedResponse;
        
        try {
          // Try to parse and format as JSON
          const jsonResponse = JSON.parse(responseData);
          formattedResponse = JSON.stringify(jsonResponse, null, 2);
        } catch (e) {
          // If not valid JSON, show as is
          formattedResponse = responseData;
        }
        
        document.getElementById('response').innerHTML = formattedResponse;
        
        // Add to history
        const historyItem = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          method,
          endpoint,
          url,
          payload,
          response: formattedResponse,
          status: response.status,
          duration
        };
        
        history.unshift(historyItem);
        updateHistoryList();
      } catch (error) {
        document.getElementById('response').innerHTML = 'Error: ' + error.message;
      }
    });
    
    // Poll for logs
    function pollLogs() {
      // Use a direct hardcoded URL here
      fetch('http://localhost:' + serverPort + '/__logs')
        .then(response => response.json())
        .then(data => {
          if (data && data.logs) {
            const logsEl = document.getElementById('logs');
            logsEl.innerHTML = data.logs.join('\\n');
            
            // Auto-scroll to bottom if already at bottom
            const isAtBottom = logsEl.scrollHeight - logsEl.clientHeight <= logsEl.scrollTop + 50;
            if (isAtBottom) {
              logsEl.scrollTop = logsEl.scrollHeight;
            }
          }
        })
        .catch(error => console.error('Error fetching logs:', error));
    }
    
    // Update history list
    function updateHistoryList() {
      const historyList = document.getElementById('history-list');
      historyList.innerHTML = '';
      
      if (history.length === 0) {
        historyList.innerHTML = '<p>No requests yet</p>';
        return;
      }
      
      history.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        
        const statusClass = item.status >= 200 && item.status < 300 ? 'status-success' : 'status-error';
        
        el.innerHTML = \`
          <div>
            <span class="request-method">\${item.method}</span>
            <span>\${item.endpoint}</span>
            <span class="status \${statusClass}">\${item.status}</span>
            <small>\${item.duration}ms</small>
          </div>
          <div><small>\${new Date(item.timestamp).toLocaleTimeString()}</small></div>
        \`;
        
        el.addEventListener('click', () => {
          document.getElementById('method').value = item.method;
          document.getElementById('endpoint').value = item.endpoint;
          document.getElementById('payload').value = JSON.stringify(item.payload, null, 2);
          document.getElementById('response').innerHTML = item.response;
          
          // Switch to request tab
          document.querySelector('.tab[data-tab="request"]').click();
        });
        
        historyList.appendChild(el);
      });
    }
    
    // Initialize
    setInterval(pollLogs, 1000);
    updateHistoryList();
  </script>
</body>
</html>
`;
}