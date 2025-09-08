import React from 'react';

/**
 * Component to display results and errors from function invocation
 * 
 * @param {Object} props - Component props
 * @param {Object} props.result - Result data to display
 * @param {Object} props.error - Error object to display
 * @param {boolean} props.isLoading - Loading state
 */
function ResultDisplay({ result, error, isLoading }) {
  // Helper to format data for display
  const formatData = (data) => {
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-gray-900">Results</h2>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center items-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div>
          <span className="ml-3 text-gray-700">Processing...</span>
        </div>
      )}
      
      {/* Error display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-start">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error.message || 'An unknown error occurred'}</p>
                {error.details && (
                  <pre className="mt-1 text-xs overflow-auto max-h-40 bg-red-100 p-2 rounded">
                    {formatData(error.details)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Result display */}
      {result && (
        <div className="bg-gray-50 rounded border border-gray-200 overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">
              {result.message || 'Result'}
            </h3>
          </div>
          <pre className="p-4 overflow-auto max-h-80 text-sm text-gray-800">
            {formatData(result.data || result)}
          </pre>
        </div>
      )}
      
      {/* Empty state */}
      {!isLoading && !result && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center text-gray-500">
          Submit a request to see results here
        </div>
      )}
    </div>
  );
}

export default ResultDisplay;