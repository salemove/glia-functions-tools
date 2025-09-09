/**
 * Colorizer utility - provides a chalk-compatible API using picocolors
 * This wrapper eases the migration from chalk to picocolors by maintaining
 * similar chaining patterns and API surface.
 */
import pc from 'picocolors';

// Basic colors available in picocolors
const COLORS = [
  'black', 'red', 'green', 'yellow', 'blue', 
  'magenta', 'cyan', 'white', 'gray', 'dim'
];

// Modifiers available in picocolors
const MODIFIERS = ['bold', 'italic', 'underline', 'reset'];

// Background colors available in picocolors
const BG_COLORS = ['bgBlack', 'bgRed', 'bgGreen', 'bgYellow', 'bgBlue', 'bgMagenta', 'bgCyan', 'bgWhite'];

/**
 * Creates a chalk-like API wrapper for picocolors
 * Allows for method chaining similar to chalk, but uses picocolors under the hood
 */
function createChainableColorizer() {
  const colorizer = (text) => text;
  
  // Array to track applied styles for chaining
  const styleChain = [];
  
  // Apply all styles in the chain to the text
  colorizer.applyStyles = (text) => {
    if (styleChain.length === 0) return text;
    
    // Apply styles in reverse order (innermost first)
    return styleChain.reduce((result, style) => {
      return pc[style](result);
    }, text);
  };
  
  // Main colorizer function when called directly
  const handler = {
    apply(target, thisArg, args) {
      const text = args[0];
      return colorizer.applyStyles(text);
    }
  };
  
  // Property access for chaining
  const propertyHandler = {
    get(target, prop) {
      // Handle hex colors specially
      if (prop === 'hex') {
        return (hexColor) => {
          // Add a hex handler that simply uses the closest color
          // This is a simplification as picocolors doesn't support hex directly
          // For full production use, you'd want to map hex colors to the closest available color
          return createChainableColorizer([...styleChain, 'cyan']); // Using cyan as fallback
        };
      }
      
      // For normal color/modifier methods
      if ([...COLORS, ...MODIFIERS, ...BG_COLORS].includes(prop)) {
        // Create a new colorizer with this style added to the chain
        const newStyleChain = [...styleChain, prop];
        
        // Create chainable version with this style
        const chainableColorizer = createChainableColorizer(newStyleChain);
        
        // Also make it callable like chalk.red('text')
        return new Proxy(function(text) {
          return pc[prop](colorizer.applyStyles(text));
        }, {
          get: (target, nextProp) => propertyHandler.get(chainableColorizer, nextProp)
        });
      }
      
      return target[prop];
    }
  };
  
  // Create the chainable proxy
  return new Proxy(colorizer, {
    get: propertyHandler.get,
    apply: handler.apply
  });
}

// Create the main colorizer instance
const colorizer = createChainableColorizer();

// Add support for checking color support
colorizer.isColorSupported = pc.isColorSupported;

export default colorizer;