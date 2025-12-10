/**
 * Start the MCP server
 *
 * This command starts the MCP (Model Context Protocol) server located in the ./mcp-server directory,
 * which enables AI assistants to interact with Glia Functions programmatically using standard input/output.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Start the MCP server
 *
 * @param {Object} options - Command options (unused)
 */
export async function startMcpServer(options = {}) {
  // Get the path to the MCP server
  const serverPath = path.resolve(__dirname, '../../mcp-server/server.js');

  // Prepare environment variables
  const env = { ...process.env };

  // Log startup info to stderr (not stdout, as stdout is reserved for MCP protocol)
  console.error('Starting Glia Functions MCP server...');
  console.error('The server is now ready to accept MCP protocol messages.');
  console.error('');
  console.error('To stop the server, press Ctrl+C');
  console.error('');

  // Start the MCP server as a child process
  const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env
  });

  // Handle server exit
  serverProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`MCP server exited with code ${code}`);
      process.exit(code);
    } else if (signal) {
      console.error(`MCP server was killed by signal ${signal}`);
      process.exit(1);
    }
  });

  // Handle errors
  serverProcess.on('error', (error) => {
    console.error('Failed to start MCP server:', error.message);
    process.exit(1);
  });

  // Handle process termination signals
  const shutdown = () => {
    console.error('\nShutting down MCP server...');
    serverProcess.kill('SIGTERM');

    // Force kill after 5 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('Force killing MCP server...');
      serverProcess.kill('SIGKILL');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process running
  await new Promise(() => {});
}

export default startMcpServer;
