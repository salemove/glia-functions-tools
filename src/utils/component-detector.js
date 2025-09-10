/**
 * Component detector
 * 
 * This module provides utilities for detecting Glia components (functions, applets)
 * in project files, and analyzing their structure.
 */
import fs from 'fs/promises';
import path from 'path';
import glob from 'glob';
import { promisify } from 'util';

// Convert callback-based glob to Promise-based
const globAsync = promisify(glob);

/**
 * Detect if a file is a Glia function
 * 
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if the file is a Glia function
 */
export async function isGliaFunction(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Simple pattern matching for common Glia function signatures
    const functionPatterns = [
      // Export named function onInvoke pattern
      /export\s+(?:async\s+)?function\s+onInvoke\s*\(/,
      // Export arrow function onInvoke pattern
      /export\s+const\s+onInvoke\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
      // Other common patterns
      /export\s+(?:async\s+)?function\s+handleRequest\s*\(/,
      /export\s+default\s+(?:async\s+)?function\s*\(/,
      // kvStoreFactory parameter is a strong indicator
      /\(\s*request\s*,\s*env\s*,\s*kvStoreFactory\s*\)/
    ];
    
    // Check for any of the patterns
    return functionPatterns.some(pattern => pattern.test(content));
  } catch (error) {
    console.warn(`Error detecting Glia function in ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Detect if a file is a Glia applet
 * 
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if the file is a Glia applet
 */
export async function isGliaApplet(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check for common Glia applet patterns
    const appletPatterns = [
      /<glia-widget/i,
      /glia\.chat/i,
      /salemove\.chat/i,
      /salemove\.engagement/i,
      /data-engagement-id/i,
      /glia\.visitor/i,
      // Look for common Glia script includes
      /<script[^>]*src=["']https?:\/\/[^"']*glia\.com/i
    ];
    
    // Check for any of the patterns
    return appletPatterns.some(pattern => pattern.test(content));
  } catch (error) {
    console.warn(`Error detecting Glia applet in ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Detect KV namespaces used in a function file
 * 
 * @param {string} filePath - Path to the function file
 * @returns {Promise<string[]>} Array of detected KV namespace names
 */
export async function detectKvNamespaces(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const namespaces = new Set();
    
    // Pattern for direct namespace initialization
    const directPattern = /kvStoreFactory\.initializeKvStore\s*\(\s*["']([^"']+)["']\s*\)/g;
    let match;
    while ((match = directPattern.exec(content)) !== null) {
      namespaces.add(match[1]);
    }
    
    // Pattern for variable-based namespace
    const varPattern = /const\s+(\w+)\s*=\s*["']([^"']+)["']/g;
    const varMatches = {};
    while ((match = varPattern.exec(content)) !== null) {
      varMatches[match[1]] = match[2];
    }
    
    // Look for variable usage in kvStoreFactory
    const useVarPattern = /kvStoreFactory\.initializeKvStore\s*\(\s*(\w+)\s*\)/g;
    while ((match = useVarPattern.exec(content)) !== null) {
      if (varMatches[match[1]]) {
        namespaces.add(varMatches[match[1]]);
      }
    }
    
    // Pattern for environment variable with fallback
    const envPattern = /env\.(\w+)\s*\|\|\s*["']([^"']+)["']/g;
    while ((match = envPattern.exec(content)) !== null) {
      if (match[1].includes('NAMESPACE') || match[1].includes('KV_')) {
        namespaces.add(match[2]);
      }
    }
    
    return Array.from(namespaces);
  } catch (error) {
    console.warn(`Error detecting KV namespaces in ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Find all JavaScript files in a directory
 * 
 * @param {string} directory - Directory to search
 * @returns {Promise<string[]>} Array of JavaScript file paths
 */
export async function findJavaScriptFiles(directory) {
  try {
    const pattern = path.join(directory, '**/*.js');
    return await globAsync(pattern, {
      ignore: ['**/node_modules/**', '**/\\.git/**'],
      nodir: true
    });
  } catch (error) {
    console.warn(`Error finding JavaScript files in ${directory}: ${error.message}`);
    return [];
  }
}

/**
 * Find all HTML files in a directory
 * 
 * @param {string} directory - Directory to search
 * @returns {Promise<string[]>} Array of HTML file paths
 */
export async function findHtmlFiles(directory) {
  try {
    const pattern = path.join(directory, '**/*.html');
    return await globAsync(pattern, {
      ignore: ['**/node_modules/**', '**/\\.git/**'],
      nodir: true
    });
  } catch (error) {
    console.warn(`Error finding HTML files in ${directory}: ${error.message}`);
    return [];
  }
}

export default {
  isGliaFunction,
  isGliaApplet,
  detectKvNamespaces,
  findJavaScriptFiles,
  findHtmlFiles
};