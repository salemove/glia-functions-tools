# Glia Functions CLI

A user-friendly command-line interface for managing Glia Functions.

## 🚀 Quick Start

### First Time Setup

Run the interactive configuration setup:

```bash
python glia-function-cli.py configure
```

This will prompt you for:
- API Key ID
- API Key Secret (hidden input)
- Default Site ID
- Environment (production/beta)

Your configuration will be saved to `~/.glia/config.json`.

### View Current Configuration

```bash
python glia-function-cli.py show-config
```

## 🎯 Function Context (NEW!)

The CLI now supports working with a "current function" to streamline your workflow. Instead of specifying `--function_id` for every command, you can select a function to work on:

**Select a function to work on:**
```bash
python glia-function-cli.py select
```

**Show current function:**
```bash
python glia-function-cli.py current
```

**Clear function selection:**
```bash
python glia-function-cli.py clear
```

Once you've selected a function, you can run commands without `--function_id`:
```bash
# Instead of: python glia-function-cli.py get-info --function_id abc123
python glia-function-cli.py get-info

# Instead of: python glia-function-cli.py update --function_id abc123 --code function.js --env_file env.json
python glia-function-cli.py update --code function.js --env_file env.json
```

## 📋 Available Commands

### Function Management

**List all functions:**
```bash
python glia-function-cli.py list
```

**Create a new function:**
```bash
python glia-function-cli.py create --name "my-function" --description "My awesome function"
```

**Update function metadata:**
```bash
python glia-function-cli.py update-metadata --function_id abc123 --name "New Name" --description "Updated description"
```

**Get function information:**
```bash
# For current function
python glia-function-cli.py get-info

# For specific function
python glia-function-cli.py get-info --function_id abc123
```

### Version Management

**Update and deploy a function (creates new version):**
```bash
# For current function
python glia-function-cli.py update --code function.js --env_file example-env.json

# For specific function
python glia-function-cli.py update --function_id abc123 --code function.js --env_file example-env.json
```

**List function versions:**
```bash
# For current function
python glia-function-cli.py list-versions

# For specific function
python glia-function-cli.py list-versions --function_id abc123
```

**Deploy a specific version:**
```bash
# For current function
python glia-function-cli.py deploy --version_id v1.0.0

# For specific function
python glia-function-cli.py deploy --function_id abc123 --version_id v1.0.0
```

**Get function version details:**
```bash
python glia-function-cli.py get-version --function_id abc123 --version_id v1.0.0
```

**Get function code:**
```bash
python glia-function-cli.py get-code --function_id abc123 --version_id v1.0.0
```

### Function Execution

**Invoke a function:**
```bash
python glia-function-cli.py invoke --endpoint "/integrations/xyz/endpoint" --payload example-payload.json
```

### Monitoring & Analytics

**Get function logs:**
```bash
# For current function with specific date range
python glia-function-cli.py get-logs --start_date 2024-01-01 --end_date 2024-01-02

# Recent logs (easier for development)
python glia-function-cli.py recent-logs                    # Last hour
python glia-function-cli.py recent-logs --hours 6          # Last 6 hours  
python glia-function-cli.py recent-logs --minutes 30       # Last 30 minutes

# For specific function
python glia-function-cli.py get-logs --function_id abc123 --start_date 2024-01-01 --end_date 2024-01-02
```

**Supported date formats:**
- `2024-01-01` (converts to start/end of day)
- `2024-01-01 12:30:00` (specific time)
- `2024-01-01T12:30:00Z` (ISO-8601 format)
- `2024/01/01` or `01/01/2024` (alternative formats)

**Get function statistics:**
```bash
# All functions
python glia-function-cli.py get-stats

# Specific functions
python glia-function-cli.py get-stats --function_ids abc123 def456
```

**Check task status:**
```bash
python glia-function-cli.py task-status --function_id abc123 --task_id task123
```

### KV Store Operations

**Set a key-value pair:**
```bash
python glia-function-cli.py kv-set --namespace my_app --key user_id --value "12345"
```

**Get a value:**
```bash
python glia-function-cli.py kv-get --namespace my_app --key user_id
```

**Delete a key:**
```bash
python glia-function-cli.py kv-delete --namespace my_app --key user_id
```

**List all keys in a namespace:**
```bash
python glia-function-cli.py kv-list --namespace my_app
```

**Bulk operations:**
```bash
python glia-function-cli.py kv-bulk --namespace my_app --kv_operations example-kv-operations.json
```

## 🔧 Configuration Options

### Environment Override

Use a different environment for a single command:
```bash
# US regions
python glia-function-cli.py create --name "test-function" --environment production
python glia-function-cli.py create --name "test-function" --environment beta

# EU regions  
python glia-function-cli.py create --name "test-function" --environment production-eu
python glia-function-cli.py create --name "test-function" --environment beta-eu
```

### Site ID Override

Use a different site ID for a single command:
```bash
python glia-function-cli.py create --name "test-function" --site_id different-site-id
```

### Pagination Options

Control list output:
```bash
python glia-function-cli.py list-versions --function_id abc123 --per_page 50 --order asc
```

### Verbose Output

Enable detailed output:
```bash
python glia-function-cli.py update --function_id abc123 --code function.js --env_file env.json --verbose
```

## 📁 File Formats

### Environment Variables File (JSON)
```json
{
  "NODE_ENV": "production",
  "DEBUG": "false",
  "API_TIMEOUT": "30000"
}
```

### Payload File (JSON)
```json
{
  "message": "Hello, World!",
  "data": {
    "key": "value"
  }
}
```

### KV Store Operations File (JSON)
```json
[
  {
    "op": "set",
    "key": "user_123_profile",
    "value": "Alice Johnson"
  },
  {
    "op": "get",
    "key": "session_token"
  },
  {
    "op": "testAndSet",
    "key": "counter",
    "oldValue": "5",
    "newValue": "6"
  },
  {
    "op": "delete",
    "key": "temp_data"
  }
]
```

## 🔐 Configuration File

The CLI stores configuration in `~/.glia/config.json`:

```json
{
  "api_key_id": "your-api-key-id",
  "api_key_secret": "your-api-key-secret",
  "site_id": "your-default-site-id",
  "environment": "production"
}
```

## 🆘 Getting Help

Show all available commands and options:
```bash
python glia-function-cli.py --help
```

## ✨ Features

- 🔐 **Secure Configuration**: Interactive setup with hidden password input
- 🌍 **Multi-Environment**: Support for production, beta, and EU regions
- 📁 **File-based Config**: Persistent configuration storage
- 🎯 **Smart Defaults**: Uses configured defaults, allows command-line overrides
- 🚨 **Better Error Handling**: Clear error messages and helpful suggestions
- 📊 **Progress Indicators**: Visual feedback for long-running operations
- 🔍 **Verbose Mode**: Detailed output for debugging
- 📋 **Complete API Coverage**: All Glia Functions API endpoints supported
- 💾 **KV Store Management**: Full support for Functions KV Store operations
- 📈 **Analytics & Monitoring**: Function statistics and comprehensive logging
- 🔄 **Bulk Operations**: Efficient batch operations for KV Store
- 📄 **Pagination Support**: Handle large datasets with proper pagination
- 🎯 **Function Context**: Select a function to work on and run commands without specifying IDs
- 🔄 **Stateful Workflow**: Maintains context between commands for seamless development

## 🔄 Migration from Environment Variables

If you were previously using environment variables, the CLI will automatically detect and use them if no configuration file exists. Run `configure` to create a persistent configuration file.

Legacy environment variables:
- `api_key_id`
- `api_key_secret` 
- `site_id`
- `GLIA_ENV`