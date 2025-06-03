/**
 * Request handler for the development server
 * 
 * @param {Request} request - Fetch API Request object
 * @param {string} testPageHtml - HTML content for the test page
 * @returns {Response} - Fetch API Response object
 */
export default async function handleRequest(request, { testPageHtml, port, logs }) {
  const url = new URL(request.url);
  
  // Special route for logs
  if (url.pathname === '/__logs') {
    return new Response(JSON.stringify({ logs: globalThis._logs || logs || [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // UI for root path
  if (request.method === 'GET' && url.pathname === '/') {
    return new Response(testPageHtml, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  try {
    // Log incoming request
    console.log(`${request.method} ${url.pathname}`);
    
    // Create mock invoker
    const mockInvoker = {
      type: 'development',
      id: 'local-dev-server',
      timestamp: new Date().toISOString()
    };
    
    let gliaRequest;
    let gliaResponse;
    
    // Log start time
    console.log('Invoking function...');
    const startTime = Date.now();
    
    // Handle request differently based on method
    if (request.method === 'GET' || request.method === 'HEAD') {
      // For GET/HEAD requests, we can't add a body, so we need to modify how onInvoke works
      // Create a POST clone to work with onInvoke
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
      gliaRequest = new Request(request.url, {
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
    console.log(`Function executed in ${Date.now() - startTime}ms`);
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