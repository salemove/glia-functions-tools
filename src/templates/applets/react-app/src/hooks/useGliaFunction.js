import { useState, useCallback } from 'react';
import { invokeGliaFunction } from '../utils/api';

/**
 * Custom hook for invoking Glia functions
 * 
 * @param {Object} options - Hook options
 * @param {Function} options.onSuccess - Callback for successful invocation
 * @param {Function} options.onError - Callback for error handling
 * @returns {Object} - Hook interface
 */
export function useGliaFunction({ onSuccess, onError }) {
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  /**
   * Invoke a Glia function with the provided payload
   * 
   * @param {Object} payload - Data to send to the function
   */
  const invokeFunction = useCallback(async (payload) => {
    setIsLoading(true);
    
    try {
      // Call the function
      const result = await invokeGliaFunction(payload);
      
      // Handle success
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      console.error('Error invoking function:', error);
      
      // Handle error
      if (onError) {
        onError(error);
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError]);
  
  return {
    invokeFunction,
    isLoading
  };
}

export default useGliaFunction;