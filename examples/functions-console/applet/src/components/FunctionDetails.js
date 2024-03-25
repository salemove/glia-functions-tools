import React, { useState } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-github';

const FunctionDetails = ({ navigateTo }) => {
  const [view, setView] = useState('createVersion');
  const [code, setCode] = useState('addEventListener("fetch", (event) => {\n  event.respondWith(handleRequest(event.request));\n});\n\nasync function handleRequest(request) {\n  return new Response("Hello World", { status: 200 });\n}');

  const handleSave = () => {
    // Save the code
    console.log('Saved:', code);
    // Show deploy button
  };

  return (
    <div className="mt-8">
      <h1 className="text-3xl font-bold mb-4">Function Details</h1>
      <div className="space-x-4">
        <button onClick={() => setView('createVersion')} className="bg-blue-500 text-white px-4 py-2 rounded">
          Create Function Version
        </button>
        <button onClick={() => setView('listVersions')} className="bg-blue-500 text-white px-4 py-2 rounded">
          List Versions
        </button>
        <button onClick={() => setView('fetchLogs')} className="bg-blue-500 text-white px-4 py-2 rounded">
          Fetch Logs
        </button>
      </div>

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
