import React, { useState, useEffect } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-github';

const fetchFunctionPromise = (functionId, headers) => {
  return fetch(
      `https://api.glia.com/functions/${functionId}`,
      {
          method: 'GET',
          headers: headers
      }
  )
};

const fetchFunctionVersionCodePromise = (functionId, versionId, headers) => {
  return fetch(
      `https://api.glia.com/functions/${functionId}/versions/${versionId}/code`,
      {
          method: 'GET',
          headers: headers
      }
  )
};

const fetchLogsPromise = (functionId, headers) => {
  return fetch(
      `https://api.glia.com/functions/${functionId}/logs`,
      {
          method: 'GET',
          headers: headers
      }
  )
};

const FunctionDetails = ({ func, navigateTo }) => {
  const [view, setView] = useState('createVersion');
  const [code, setCode] = useState('addEventListener("fetch", (event) => {\n  event.respondWith(handleRequest(event.request));\n});\n\nasync function handleRequest(request) {\n  return new Response("Hello World", { status: 200 });\n}');
  const [logs, setLogs] = useState(null);

  const handleSave = () => {
    // Save the code
    console.log('Saved:', code);
    // Show deploy button
  };

  const fetchLogs = () => {
    setView('fetchLogs')
    window.getGliaApi({ version: 'v1' })
      .then(api =>
        api.getRequestHeaders()
          .then(headers =>
            fetchLogsPromise(func.id, headers) // Create fetchFunctionLogsPromise similar to other fetch functions
              .then(response => response.json())
              .then(logsData => setLogs(logsData.logs))
          )
      );
  };

  useEffect(() => {
    window.getGliaApi({version: 'v1'})
        .then(api => api.getRequestHeaders()
          .then(headers => fetchFunctionPromise(func.id, headers)
            .then(f => f.json()
              .then(functionJson => {
                console.log(functionJson)
                return fetchFunctionVersionCodePromise(func.id, functionJson.current_version.id, headers)
                  .then(versionCodeResponse => versionCodeResponse.text()
                    .then(codeString => setCode(codeString))
                  )
              })
            )
          )
        )
  }, []); 

  return (
    <div className="mt-8">
      <h1 className="text-3xl font-bold mb-4">{func.name}</h1>
      <h2 className="text-xl font-bold mb-4">Function ID: {func.id}</h2>
      <h2 className="text-xl font-bold mb-4">Function Description</h2>
      <p className="text-gray-500 dark:text-gray-400">...</p>
      <div className="space-x-4">
        <button onClick={() => setView('createVersion')} className="bg-blue-500 text-white px-4 py-2 rounded">
          Create Function Version
        </button>
        <button onClick={() => setView('listVersions')} className="bg-blue-500 text-white px-4 py-2 rounded">
          List Versions
        </button>
        <button onClick={() => fetchLogs()} className="bg-blue-500 text-white px-4 py-2 rounded">
          View Logs
        </button>
      </div>
      {view === 'fetchLogs' && (
        <div>
          <h2 className="text-2xl font-bold mb-2">Application Logs</h2>
          <button onClick={fetchLogs} className="bg-blue-500 text-white px-4 py-2 rounded mb-4">
            Fetch Logs
          </button>
          {logs && (
            <table className="table-auto w-full bg-white shadow-md rounded-lg overflow-hidden">
              <thead className="bg-gray-200 text-gray-700 uppercase text-xs font-semibold">
                <tr>
                  <th className="py-2 px-4">Message</th>
                  <th className="py-2 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 text-sm font-light">
                {logs.map(log => (
                  <tr key={log.id} className="border-b">
                    <td className="py-2 px-4">{log.message}</td>
                    <td className="py-2 px-4">{log.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === 'createVersion' && (
        <div>
          <h2 className="text-xl font-bold mb-2">Edit Function Code</h2>
          <AceEditor
            mode="javascript"
            theme="github"
            value={code}
            onChange={setCode}
            fontSize={14}
            showPrintMargin={true}
            showGutter={true}
            highlightActiveLine={true}
            setOptions={{
              useWorker: false,
              showLineNumbers: true,
              tabSize: 2,
            }}
            style={{ width: '100%', minHeight: '400px' }}
          />
          <div className="mt-4">
            <button onClick={handleSave} className="bg-green-500 text-white px-4 py-2 rounded mr-2">
              Save
            </button>
            <button onClick={() => navigateTo('functionList')} className="bg-red-500 text-white px-4 py-2 rounded">
              Cancel
            </button>
          </div>
        </div>
      )}

      <button onClick={() => navigateTo('functionList')} className="bg-blue-500 text-white px-4 py-2 rounded mt-4">
        Back to Function List
      </button>
    </div>
  );
};

export default FunctionDetails;
