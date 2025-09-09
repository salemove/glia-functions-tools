# Glia Functions CLI

Helper functions, tools, and examples for building and managing Glia Functions - a serverless functions platform similar to AWS Lambda or Cloudflare Workers using the workerd runtime for JavaScript.

[![Documentation Status](https://img.shields.io/badge/docs-latest-brightgreen.svg)](./docs)
[![API Reference](https://img.shields.io/badge/api-reference-blue.svg)](./docs/api)
[![Profile Support](https://img.shields.io/badge/profiles-supported-orange.svg)](./docs/commands/profiles.md)

## Features

- **Multi-environment support** with named profiles and site switching
- **Robust API client** with retry, caching, and offline capabilities
- **Interactive and command-driven interfaces** for both guided and automated workflows
- **Create and manage** serverless JavaScript functions
- **Function templates** for common use cases and patterns
- **Project scaffolding** with complete project templates and template inheritance
- **Deploy function versions** with custom environment variables
- **Invoke functions** with custom payloads
- **Local development server** for testing functions without deployment
- **View function logs** and details
- **Bundle dependencies** using esbuild
- **Comprehensive documentation** with architecture guides and command references
- **Extensive examples** for common integration patterns

## Prerequisites

- Node.js 16+
- A Glia account with API access
- Your Glia Site ID, API Key and Secret

## Installation

```bash
# Clone the repository
git clone https://github.com/salemove/glia-functions-tools.git

# Install dependencies
cd glia-functions-tools
npm install
```

## CLI Installation and Access

You have several options to install and access the Glia Functions CLI:

### Option 1: Use without installing globally

After completing the installation steps above, you can run the CLI directly:

```bash
# Option A: Using npm scripts
npm run cli

# Option B: Using the bin file directly
./bin/glia-functions.js

# Option C: Using node to execute the bin file
node ./bin/glia-functions.js
```

### Option 2: Install globally

To use the `glia-functions` or `glia` commands from anywhere on your system:

#### Method A: Use the installation script (recommended)

```bash
# From the repository directory
node install.js
```

#### Method B: Manual global installation

```bash
# From the repository directory
npm install -g .
```

After installing globally, you can simply use either of these commands:
```bash
glia-functions  # Full command name
glia            # Shorter alias
```

## Quick Start

1. Run the CLI setup wizard using one of these methods:
   ```bash
   # If installed globally
   glia
   
   # OR using npm scripts without global install
   npm run cli
   ```
2. Select "Setup project" and enter your Glia credentials
3. Create a new function via the CLI menu
4. Deploy a basic function:
   ```bash
   # First build your function
   npm run build ./path/to/your/function.js
   
   # Then create and deploy a version
   glia-functions create-version --function-id=your-function-id --path='./function-out.js' --deploy
   
   # OR if not installed globally
   npm run cli -- create-version --function-id=your-function-id --path='./function-out.js' --deploy
   ```

## Environment Variables

Required environment variables for authentication:

* `GLIA_KEY_ID` - Your Glia API key ID
* `GLIA_KEY_SECRET` - Your Glia API key secret
* `GLIA_SITE_ID` - Your Glia site ID
* `GLIA_API_URL` - Glia API URL (defaults to https://api.glia.com)
* `GLIA_BEARER_TOKEN` - Bearer token generated from your credentials (automatically set by the CLI)

These can be set in a `.env` file in the project root or configured via the CLI setup wizard.

## Building Your Function

Build a function for deployment:

```bash
npm run build ./path/to/your/function.js
```

This creates a bundled `function-out.js` file ready for deployment.

## CLI Usage

The CLI supports two modes of operation:

### Interactive Mode

Start the interactive CLI without any arguments:

```bash
./bin/glia-functions.js
```

This provides a menu-driven interface for:
- Setting up your environment
- Creating new functions
- Managing existing functions
- Creating and deploying function versions
- Viewing function logs
- Invoking functions
- Managing configuration profiles

### Command Mode

For automation and direct execution, you can use direct command syntax:

```bash
glia-functions <command> [options]
```

#### List Functions
```bash
glia-functions list-functions [--detailed]
```

#### Create a Function
```bash
# Create a simple function
glia-functions create-function --name "My Function" --description "Function description"

# Create a function from a template
glia-functions create-function --name "My Function" --description "Function description" --template api-integration

# List available templates
glia-functions list-templates
```

#### Update a Function
```bash
# Update a function's name
glia-functions update-function --id "function-id" --name "New Function Name"

# Update a function's description
glia-functions update-function --id "function-id" --description "New function description"

# Update both name and description
glia-functions update-function --id "function-id" --name "New Name" --description "New description"
```

#### Initialize a Project
```bash
# List available project templates
glia-functions init --list-templates

# Create a project from a template
glia-functions init --template api-integration --output ./my-api-project

# Create a project with custom variables
glia-functions init --template api-integration --variables "projectName=My API,apiKey=my-key"
```

Projects can also be created from templates that use inheritance, which allows specialized templates to extend base templates while customizing behavior. For details, see [Template Inheritance](./docs/template-inheritance.md).

#### Deploy a Function Version
```bash
glia-functions deploy --function-id <id> --version-id <id>
```

#### Update Environment Variables
```bash
# Create a new version based on an existing one with new environment variables
glia-functions update-version --function-id <id> --version-id <id> --env-vars '{"KEY":"new_value"}'

# List current environment variables for a function
glia-functions update-env-vars --id <function-id> --list

# Update environment variables for a function (adds a new version with updated env vars)
glia-functions update-env-vars --id <function-id> --env '{"KEY":"value","ANOTHER_KEY":"another_value"}'

# Update environment variables without deploying
glia-functions update-env-vars --id <function-id> --env '{"KEY":"value"}' --no-deploy

# Interactive UI for adding/updating/removing environment variables
glia-functions update-env-vars --id <function-id> --interactive
```

#### Invoke a Function
```bash
glia-functions invoke-function --function-id <id> --payload '{"key": "value"}'
```

#### Fetch Function Logs
```bash
# Fetch most recent logs (first page only)
glia-functions fetch-logs --function-id <id>

# Fetch all logs across all pages
glia-functions fetch-logs --function-id <id> --all

# Fetch logs with time range and custom output file
glia-functions fetch-logs --function-id <id> --start-time "2023-10-19T00:00:00Z" --end-time "2023-10-20T00:00:00Z" --output ./my-logs.json

# Specify maximum entries per page (default is 1000, which is the API maximum)
glia-functions fetch-logs --function-id <id> --limit 500
```

#### Run Local Development Server
```bash
# Start local development server
glia-functions dev --path ./function.js

# With options
glia-functions dev --path ./function.js --port 3000 --watch --env '{"KEY":"value"}'
```

The local development server provides:
- A simulated workerd runtime environment for testing
- Web UI for sending test requests to your function
- Real-time console logging display
- Environment variable configuration interface
- Request history tracking
- Hot reloading when files change (with --watch flag)

See the [Development Server Documentation](./docs/dev-server.md) for detailed usage.

#### Using Profiles and Sites
```bash
# List available profiles
glia-functions profiles list

# Create a new profile
glia-functions profiles create --name production

# Switch to a profile
glia-functions profiles switch --name production

# Change active site within current profile
glia-functions change-site

# Use a specific profile for a single command
glia-functions list-functions --profile staging
```

For comprehensive command documentation, see the [Command Reference](./docs/commands/index.md).

### Legacy Command-line Scripts (Deprecated)

The individual command scripts still work for backward compatibility:

```bash
# Individual commands (deprecated)
node ./src/commands/listFunctions.js
node ./src/commands/createAndDeployVersion.js --id=$FUNCTION_ID --path='./function-out.js' --env='{"key": "value"}'
node ./src/commands/invokeFunction.js --uri=$INVOCATION_URI
node ./src/commands/fetchLogs.js --id=$FUNCTION_ID
```

For detailed CLI usage information, see the [CLI Usage Documentation](./docs/cli-usage.md).

## Examples

The `/examples` directory contains ready-to-use function examples demonstrating various integration patterns:

- `iva-as-ivr`: Build an Intelligent Virtual Assistant with voice interactions
- `genai`: Integrate with generative AI services
- `bedrock-agent`: AWS Bedrock integration example
- `s3-export`: AWS S3 data export capabilities
- `teams-presence`: Microsoft Teams presence integration
- And more...

See the [Examples Documentation](./examples/README.md) for details on each example.

## Migration Guide

The project is undergoing an architectural migration to improve code quality and maintainability. During this transition:

- **Legacy paths are deprecated** but still work for backward compatibility
- All new development should use the modern architecture

### Deprecated Paths (Legacy)

The following path is deprecated and will be removed in a future release:

- `index.js` - Use `bin/glia-functions.js` instead

The following directories have been removed as part of the architecture migration:

- `utils/` - Use `src/utils/` instead (removed March 2025)
- `commands/` - Use `src/commands/` instead (removed March 2025)

### Migration Path

If you've built scripts that rely on the legacy structure, please update your imports to use the new paths:

**Before:**
```javascript
import createGliaFunction from './utils/create-gf.js';
import { createFunction } from './commands/index.js';
```

**After:**
```javascript
import { createGliaFunction } from './src/utils/index.js'; 
import { createFunction } from './src/commands/index.js';
```

## Project Structure

```
glia-functions-tools/
├── bin/                      # Executable entry points
│   └── glia-functions.js     # Main CLI executable
├── src/                      # Source code (core implementation)
│   ├── commands/             # Command implementations
│   ├── utils/                # Utility functions
│   ├── lib/                  # Core libraries
│   ├── cli/                  # CLI implementation
│   └── templates/            # Function templates
├── examples/                 # Example functions and applets
├── backup/                   # Backup of removed legacy code
├── index.js                  # Legacy CLI entry point (deprecated)
├── config/                   # Configuration files
└── docs/                     # Documentation
```

For more details on the migration, see the [Architecture Migration Plan](./docs/architecture-migration.md).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

See the [LICENSE](LICENSE) file for details.
