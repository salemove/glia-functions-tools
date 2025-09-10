# Glia Functions MCP Server

An MCP (Model Context Protocol) server that exposes all Glia Functions CLI operations as tools. Built using the [fastmcp](https://gofastmcp.com/) framework.

## Features

This MCP server provides tools for all major Glia Functions operations:

### Configuration
- `configure_glia_functions` - Set up API credentials and environment
- `show_glia_config` - Display current configuration
- `select_glia_function` - List available functions for selection
- `set_current_glia_function` - Set a function as current working function
- `get_current_glia_function` - Get currently selected function
- `clear_current_glia_function` - Clear function selection

### Function Management
- `create_glia_function` - Create a new function
- `update_glia_function` - Update function code and environment variables
- `deploy_glia_function` - Deploy a function version
- `get_glia_function_info` - Get function information
- `list_glia_functions` - List all functions in a site
- `update_glia_function_metadata` - Update function name/description

### Version Management
- `get_glia_function_version` - Get version information
- `get_glia_function_code` - Get code for a specific version
- `list_glia_function_versions` - List all versions of a function

### Function Invocation
- `invoke_glia_function` - Invoke a function with payload

### Monitoring & Logs
- `get_glia_function_logs` - Get logs for a date range
- `get_glia_function_recent_logs` - Get recent logs (last N hours)
- `get_glia_function_stats` - Get invocation statistics

### KV Store Operations
- `glia_kv_set` - Set a key-value pair
- `glia_kv_get` - Get a value by key
- `glia_kv_delete` - Delete a key
- `glia_kv_list` - List all keys in a namespace
- `glia_kv_bulk` - Perform bulk operations

## Installation

### Using uv (Recommended)

1. Make sure you have `uv` installed. If not, install it:
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or using pip
pip install uv
```

2. Navigate to the mcp directory:
```bash
cd mcp
```

3. Install dependencies and create virtual environment:
```bash
uv sync
```

### Alternative: Using pip

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure you have the original `glia-function-cli.py` file in the parent directory.

## Usage

### Running the MCP Server

#### Using uv (Recommended)
```bash
cd mcp
uv run glia_functions_mcp_server.py
```

#### Or using the shell script
```bash
cd mcp
./run.sh
```

#### Or using the installed script
```bash
cd mcp
uv run glia-functions-mcp
```

#### Using python directly
```bash
cd mcp
python glia_functions_mcp_server.py
```

The server will start with SSE (Server-Sent Events) transport and will be available at `http://localhost:8000` by default.

### Configuration

First, configure your Glia API credentials:

```python
# Using the MCP tool
configure_glia_functions(
    api_key_id="your_api_key_id",
    api_key_secret="your_api_key_secret", 
    site_id="your_site_id",
    environment="production"
)
```

### Working with Functions

The server supports a "current function" concept to make operations easier:

```python
# List and select a function
functions = select_glia_function()
set_current_glia_function("function_id_here")

# Now you can use tools without specifying function_id
info = get_glia_function_info()
logs = get_glia_function_recent_logs(hours=2)
versions = list_glia_function_versions()
```

### Example Operations

```python
# Create a new function
result = create_glia_function(
    name="my-awesome-function",
    description="Does awesome things"
)

# Update function code
update_glia_function(
    code="""
    export default {
        async fetch(request, env) {
            return new Response('Hello World!');
        }
    }
    """,
    env_variables={"DEBUG": "true"},
    auto_deploy=True
)

# Get recent logs
logs = get_glia_function_recent_logs(hours=1)

# KV Store operations
glia_kv_set("my_namespace", "user_id", "12345")
value = glia_kv_get("my_namespace", "user_id")
```

## Environment Support

The server supports all Glia environments:
- `production` (US) - https://api.glia.com
- `beta` (US) - https://api.beta.glia.com  
- `production-eu` (EU) - https://api.glia.eu
- `beta-eu` (EU) - https://api.beta.glia.eu

## Error Handling

All tools include proper error handling and will raise descriptive errors for:
- Missing credentials
- Invalid parameters
- API errors
- Network issues

## Dependencies

- `fastmcp` - MCP server framework
- `requests` - HTTP client for API calls
- Standard library modules for file handling and JSON processing