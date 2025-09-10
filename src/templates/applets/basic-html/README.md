# {{appletName}}

{{description}}

## Overview

This is a Glia Applet project created using the basic HTML applet template. It includes both a frontend applet and a backend function.

## Project Structure

- `applet.html`: The HTML applet that will be displayed in the Glia engagement window
- `function.js`: Backend function that supports the applet
- `glia-project.json`: Project manifest file for deploying all components together

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- A Glia account with API access
- Glia Functions CLI installed

### Development Workflow

1. Edit `applet.html` and `function.js` to implement your desired functionality

2. Deploy the entire project:
   ```
   glia deploy-project
   ```

3. View logs:
   ```
   glia logs [function-name]
   ```

## Project Deployment

This project uses a manifest file (`glia-project.json`) to deploy all components together:

1. Deploy all components with a single command:
   ```
   glia deploy-project
   ```

2. Test with dry-run to see what would be deployed:
   ```
   glia deploy-project --dry-run
   ```

## Linkages

The function and applet are automatically linked during deployment, with the function's invocation URI available to the applet via the `API_URL` placeholder.

## License

MIT