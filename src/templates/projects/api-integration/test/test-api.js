/**
 * API Integration Test for {{projectName}}
 * 
 * This script tests the API client against the actual API.
 * It requires valid API credentials in your .env file.
 */

import { makeApiRequest } from '../lib/api-client.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testApiConnection() {
  const apiKey = process.env.API_KEY;
  const apiUrl = process.env.API_URL;
  
  if (!apiKey) {
    console.error('❌ Error: Missing API_KEY in .env file');
    process.exit(1);
  }
  
  if (!apiUrl) {
    console.warn('⚠️ Warning: Missing API_URL in .env file. Using default URL.');
  }
  
  console.log(`🔍 Testing API connection to ${apiUrl || 'https://api.example.com/v1'}...`);
  
  try {
    const response = await makeApiRequest({
      url: apiUrl || 'https://api.example.com/v1',
      method: 'POST',
      apiKey: apiKey,
      payload: {
        query: 'test-query',
        limit: 5
      },
      timeout: 10000
    });
    
    console.log('✅ API connection successful!');
    console.log('📊 Response:', JSON.stringify(response, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ API connection failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    return false;
  }
}

// Run the test
testApiConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });