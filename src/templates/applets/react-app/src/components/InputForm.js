import React, { useState } from 'react';
import { useGliaFunction } from '../hooks/useGliaFunction';

/**
 * Form for user input to interact with the function
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onResult - Callback when result is received
 * @param {Function} props.onError - Callback when error occurs
 * @param {Function} props.onLoadingChange - Callback to update loading state
 */
function InputForm({ onResult, onError, onLoadingChange }) {
  // Form state
  const [text, setText] = useState('');
  const [number, setNumber] = useState(10);
  const [option, setOption] = useState('option1');
  const [formAction, setFormAction] = useState('process');
  const [analysisText, setAnalysisText] = useState('');

  // Initialize hook for function invocation
  const { invokeFunction, isLoading } = useGliaFunction({
    onSuccess: onResult,
    onError,
  });

  // Update loading state when it changes
  React.useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading);
    }
  }, [isLoading, onLoadingChange]);

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let payload;
    
    // Prepare payload based on action
    switch (formAction) {
      case 'process':
        payload = {
          action: 'process',
          data: {
            text,
            number: parseFloat(number),
            options: {
              selectedOption: option
            }
          }
        };
        break;
        
      case 'fetch-data':
        payload = {
          action: 'fetch-data',
          data: {
            timestamp: new Date().toISOString()
          }
        };
        break;
        
      case 'analyze':
        payload = {
          action: 'analyze',
          data: {
            content: analysisText
          }
        };
        break;
        
      default:
        onError(new Error(`Unknown action: ${formAction}`));
        return;
    }
    
    // Invoke the function
    await invokeFunction(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Action
        </label>
        <select
          value={formAction}
          onChange={(e) => setFormAction(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="process">Process Data</option>
          <option value="fetch-data">Fetch Sample Data</option>
          <option value="analyze">Analyze Text</option>
        </select>
      </div>

      {formAction === 'process' && (
        <>
          <div className="mb-4">
            <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
              Text Input
            </label>
            <input
              id="text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter some text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="number" className="block text-sm font-medium text-gray-700 mb-2">
              Number Input
            </label>
            <input
              id="number"
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="option" className="block text-sm font-medium text-gray-700 mb-2">
              Select Option
            </label>
            <select
              id="option"
              value={option}
              onChange={(e) => setOption(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="option1">Option 1</option>
              <option value="option2">Option 2</option>
              <option value="option3">Option 3</option>
            </select>
          </div>
        </>
      )}
      
      {formAction === 'analyze' && (
        <div className="mb-4">
          <label htmlFor="analysisText" className="block text-sm font-medium text-gray-700 mb-2">
            Text to Analyze
          </label>
          <textarea
            id="analysisText"
            value={analysisText}
            onChange={(e) => setAnalysisText(e.target.value)}
            rows="5"
            placeholder="Enter text to analyze..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            required
          ></textarea>
        </div>
      )}
      
      <div>
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
            isLoading ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? 'Processing...' : 'Submit'}
        </button>
      </div>
    </form>
  );
}

export default InputForm;