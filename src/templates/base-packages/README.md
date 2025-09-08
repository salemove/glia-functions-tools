# Package.json Templates

This directory contains base templates for package.json files used by the Glia Functions CLI template system. These templates provide a standardized structure for different types of Glia Functions projects while allowing for customization and extension.

## How Package.json Templates Work

The package.json template system leverages the template inheritance mechanism to create consistent, customizable package.json files for new projects. Key features include:

1. **Base Templates**: Predefined package.json structures for different project types
2. **Template Inheritance**: Extend and customize base templates
3. **Variable Substitution**: Customize fields with project-specific values
4. **Dependency Management**: Centralized dependency version control
5. **Script Collections**: Reusable script collections for common tasks

## Available Base Templates

| Template Name | Description | Use Case |
|---------------|-------------|----------|
| `base-function` | Standard function template | Basic serverless functions |
| `base-api` | API integration template | External API integrations |
| `base-kv-store` | KV store integration | Persistent data storage functions |
| `base-project` | Multi-component project | Complex projects with multiple functions/applets |

## Template Configuration

In your template.json file, add a `packageJson` section to configure package.json generation:

```json
{
  "name": "my-template",
  "displayName": "My Template",
  "description": "A custom template",
  "version": "1.0.0",
  "packageJson": {
    "inherits": "base-function",
    "components": [
      "scripts/basic",
      "scripts/watch",
      "scripts/deploy",
      "scripts/invoke"
    ],
    "customizations": {
      "scripts": {
        "custom-script": "echo 'Custom script'"
      },
      "dependencies": {
        "my-library": "^1.0.0"
      },
      "devDependencies": {
        "my-dev-tool": "^2.0.0"
      }
    }
  }
}
```

### Configuration Options

#### `inherits`

Specifies which base template to inherit from. Available options:
- `base-function`: Basic function template
- `base-api`: API integration template
- `base-kv-store`: KV store template
- `base-project`: Multi-component project template

```json
"packageJson": {
  "inherits": "base-function"
}
```

#### `components`

Array of reusable components to include. Format: `"type/name"`.

Available script collections:
- `scripts/basic`: Basic build/test scripts
- `scripts/watch`: File watching scripts
- `scripts/deploy`: Deployment scripts
- `scripts/invoke`: Function invocation scripts
- `scripts/project`: Project deployment scripts
- `scripts/kv`: KV store operations

Available dependency collections:
- `dependencies/api`: API client dependencies
- `dependencies/validation`: Data validation libraries
- `dependencies/utils`: Utility libraries

```json
"components": [
  "scripts/basic",
  "scripts/deploy",
  "dependencies/api"
]
```

#### `customizations`

Object containing custom overrides for the final package.json. Any fields specified here will override inherited values.

```json
"customizations": {
  "scripts": {
    "start": "node server.js",
    "custom": "echo 'Hello World'"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

## Variables

The package.json template system supports variable substitution. Common variables include:

- `{{projectName}}`: Name of the project
- `{{description}}`: Project description
- `{{mainFile}}`: Main file name (e.g., function.js)
- `{{author}}`: Author name

Example in template:
```json
{
  "name": "{{projectName}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "main": "{{mainFile}}",
  "author": "{{author}}"
}
```

## Advanced Usage

### Creating Custom Templates

You can create custom package.json templates by adding new files to this directory following the naming pattern `custom-name.package.json`.

### Debugging Template Generation

If you encounter issues with package.json generation, run the template generator with the `--debug` flag:

```
glia-functions init --template my-template --output ./my-project --debug
```

This will output detailed information about the template resolution process.

### Template Inheritance Chain

When a template inherits from another, the inheritance chain is resolved as follows:

1. Start with the base template specified in `inherits`
2. Apply component collections from `components`
3. Apply customizations from `customizations`
4. Process variables with values from the template context

## Best Practices

1. **Use Inheritance**: Always inherit from a base template rather than starting from scratch
2. **Be Specific**: Include only the components you need
3. **Use Variables**: Make your templates flexible with variables
4. **Version Control**: Specify precise version numbers for critical dependencies
5. **Documentation**: Add comments for any custom scripts or dependencies

## See Also

- [Template Registry Documentation](../templates/README.md)
- [Dependency Registry](../../utils/dependency-registry.js)
- [Package Template Manager](../../utils/package-template-manager.js)