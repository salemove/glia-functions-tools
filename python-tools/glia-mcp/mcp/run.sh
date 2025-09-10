#!/bin/bash
# Run the Glia Functions MCP Server using uv with SSE transport

cd "$(dirname "$0")"
uv run fastmcp run glia_functions_mcp_server.py:mcp --transport sse --log-level DEBUG  --port 1371 
