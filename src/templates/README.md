# Function Templates

This directory contains template files for creating new Glia Functions with predefined functionality and patterns. Templates help you get started quickly with common function patterns.

## Available Templates

### Basic (`basic.js`)

A minimal starting point with proper request handling and response formatting. Use this template for simple functions or as a starting point for custom implementations.

**Environment Variables:** None required

### API Integration (`api-integration.js`)

Demonstrates how to securely integrate with external APIs. This template includes authentication, error handling, and response formatting.

**Environment Variables:**
- `API_KEY`: Your API key for the external service
- `API_URL`: The API endpoint URL

### State Machine (`state-machine.js`)

A state machine pattern implementation for managing conversation flows or multi-step processes. This template is useful for complex workflows that require state tracking.

**Environment Variables:** None required

### AI Integration (`ai-integration.js`)

Integration with OpenAI's API for adding generative AI capabilities to your Glia Functions.

**Environment Variables:**
- `OPENAI_API_KEY`: Your OpenAI API key
- `MODEL`: The OpenAI model to use (default: gpt-3.5-turbo)
- `TEMPERATURE`: Temperature setting for AI responses (default: 0.7)
- `MAX_TOKENS`: Maximum tokens for completion (default: 500)

## Project Templates

The Glia Functions CLI also supports complete project templates that include:

- Main function code
- Recommended directory structure
- Package.json with scripts and dependencies
- Testing setup
- Documentation

Project templates are available for various use cases:

- **Basic Function**: Simple function template with testing setup
- **API Integration**: Complete API client with error handling and validation
- **KV Store Function**: Functions with persistent data storage capabilities

## Using Templates

### Via CLI

Use the `glia-functions` CLI to create a function from a template:

```bash
# List all available templates
glia-functions list-templates

# Create a function from a template
glia-functions create-function --name "My Function" --description "My function description" --template basic

# Create a complete project
glia-functions init --template kv-store-function --output ./my-kv-project
```

### Via Interactive Mode

1. Run the CLI in interactive mode:
   ```bash
   glia-functions
   ```

2. Select "Manage & build functions" from the main menu

3. Choose "Create new function"

4. Follow the prompts and select "Yes" when asked if you want to use a template

## Package.json Templates

The template system includes standardized package.json templates that ensure consistent structure and dependencies across projects. These templates support:

- Inheritance from base templates
- Modular script collections
- Centralized dependency management
- Variable substitution

For more information, see the [Package.json Templates documentation](../templates/base-packages/README.md).

## Adding Custom Templates

### Function Templates

To add your own function templates:

1. Create a new JavaScript file in the `src/templates/functions/` directory
2. Follow the standard template format with `onInvoke` export
3. Include a comment at the top describing the template functionality

```javascript
/**
 * My Custom Template
 * 
 * This template provides functionality for...
 */
 
export async function onInvoke(request, env) {
    // Your code here
}
```

### Project Templates

To add your own project templates:

1. Create a new directory in `src/templates/projects/your-template-name`
2. Add a `template.json` file with template metadata and configuration
3. Add your template files (function.js, README.md, etc.)

```json
{
  "name": "your-template-name",
  "displayName": "Your Template Name",
  "description": "Your template description",
  "version": "1.0.0",
  "packageJson": {
    "inherits": "base-function",
    "components": ["scripts/basic"]
  },
  "variables": {
    "projectName": {
      "description": "Project name",
      "default": "my-glia-function",
      "required": true
    }
  },
  "files": [
    "README.md",
    "function.js"
  ]
}
```

The template will automatically appear in the template listing.