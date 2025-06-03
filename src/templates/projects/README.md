# Glia Functions Project Templates

This directory contains project templates for creating complete Glia Function projects with multiple files, configurations, and best practices built-in.

## Available Project Templates

### Basic Function

A simple Glia Function with error handling and testing.

**Key features:**
- Clean project structure
- Error handling
- Jest testing setup
- Package.json with build/deploy scripts

### API Integration

A robust API integration template with error handling, validation, and testing.

**Key features:**
- API client with timeout handling
- Input validation
- Custom error types
- Rate limiting awareness
- Unit and API tests
- Complete project structure

## Using Project Templates

Project templates can be used with the `init` command:

```bash
glia-functions init --template api-integration --output ./my-api-project
```

This command will:
1. Create a new project directory
2. Copy all template files
3. Replace template variables with your values
4. Set up the initial project structure

## Template Variables

Templates use variables to customize the generated project. These variables are defined in the `template.json` file for each project template:

```json
{
  "name": "api-integration",
  "displayName": "API Integration",
  "description": "A robust API integration template",
  "version": "1.0.0",
  "variables": {
    "projectName": {
      "description": "Project name",
      "default": "api-integration",
      "required": true
    },
    "description": {
      "description": "Project description",
      "default": "An API integration Glia Function",
      "required": true
    },
    // ...other variables
  }
}
```

## Creating Custom Project Templates

To create a custom project template:

1. Create a new directory under `src/templates/projects/`
2. Add all the files you want in your template
3. Create a `template.json` file defining your template's metadata and variables
4. Use template variables in your files using `{{variableName}}` syntax

Your custom template will be automatically available in the `init` command.

## Template Structure

Each project template contains:

1. **Template files** - All files that will be copied to the new project
2. **template.json** - Template metadata and variables
3. **postInit** - Actions to perform after initialization

When the template is used, all occurrences of `{{variableName}}` in the files will be replaced with the values provided by the user or the default values.

## Post-initialization Actions

Templates can specify actions to perform after the project is created, such as:
- Installing dependencies
- Creating configuration files
- Setting up local environment