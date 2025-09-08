/**
 * API utilities for {{appletName}}
 * Handles communication with the Glia Function backend
 */

// Function invocation URI - this will be replaced with the actual URI
const FUNCTION_INVOCATION_URI = '/functions/FUNCTION_ID_PLACEHOLDER/invoke';

/**
 * Invoke a Glia function with the provided payload
 * 
 * @param {Object} payload - Data to send to the function
 * @returns {Promise<Object>} - Function response
 */
export async function invokeGliaFunction(payload) {
  try {
    // Get the Glia API instance
    const api = await window.getGliaApi({ version: 'v1' });
    
    // Get request headers with authorization
    const headers = await api.getRequestHeaders();
    headers['Content-Type'] = 'application/json';
    
    // Send request to the function
    const response = await fetch(`https://api.glia.com${FUNCTION_INVOCATION_URI}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    // Check for HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      
      const error = new Error(errorData.message || 'API request failed');
      error.status = response.status;
      error.details = errorData;
      throw error;
    }
    
    // Parse response
    const data = await response.json();
    
    // Check for application-level errors
    if (data.status === 'error') {
      const error = new Error(data.message || 'Function execution failed');
      error.details = data.details;
      throw error;
    }
    
    // Return successful response
    return data;
  } catch (error) {
    console.error('Error invoking Glia function:', error);
    throw error;
  }
}