// api.js
// Placeholder API functions
export const fetchHealthStatus = () => {
    // Simulate fetching health status from the server
    return new Promise(resolve => {
      setTimeout(() => {
        resolve('Healthy');
      }, 1000); // Simulating delay
    });
  };