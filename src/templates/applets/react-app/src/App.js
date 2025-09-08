import React, { useState } from 'react';
import Header from './components/Header';
import InputForm from './components/InputForm';
import ResultDisplay from './components/ResultDisplay';
import HistoryList from './components/HistoryList';

/**
 * Main App component for {{appletName}}
 */
function App() {
  // State
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // Handle result from form submission
  const handleResult = (data) => {
    setResult(data);
    setError(null);
    
    // Add to history
    setHistory(prevHistory => [
      {
        id: Date.now().toString(),
        timestamp: new Date(),
        data,
        success: true
      },
      ...prevHistory
    ]);
  };

  // Handle errors
  const handleError = (error) => {
    setError(error);
    setResult(null);
    
    // Add to history
    setHistory(prevHistory => [
      {
        id: Date.now().toString(),
        timestamp: new Date(),
        error,
        success: false
      },
      ...prevHistory
    ]);
  };

  // Show item from history
  const showHistoryItem = (item) => {
    if (item.success) {
      setResult(item.data);
      setError(null);
    } else {
      setError(item.error);
      setResult(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <Header title="{{appletName}}" subtitle="{{description}}" />
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="md:col-span-1">
            <InputForm 
              onResult={handleResult} 
              onError={handleError}
              onLoadingChange={setIsLoading}
            />
          </div>
          
          {/* Results Display */}
          <div className="md:col-span-1">
            <ResultDisplay 
              result={result}
              error={error}
              isLoading={isLoading}
            />
          </div>
        </div>
        
        {/* History List */}
        <div className="border-t border-gray-200 p-6">
          <HistoryList 
            history={history}
            onItemClick={showHistoryItem}
          />
        </div>
      </div>
    </div>
  );
}

export default App;