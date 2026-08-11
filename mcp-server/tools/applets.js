/**
 * MCP Tools for Applet Management
 *
 * This module provides MCP tools for creating, deploying, and managing
 * Glia applets through AI assistants.
 */

import { z } from "zod";
import {
  listTemplates,
  getTemplate
} from "../../src/utils/unified-template-manager.js";
import { validateTemplateVariables } from "../../src/utils/template-engine.js";
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import {
  makeApiClient,
  textResult,
  errorResult,
  checkDestructiveGate,
  destructiveArgs
} from "../lib/context.js";

/**
 * List available applet templates
 */
export function registerListAppletTemplates(server) {
  server.registerTool(
    "gf_list_applet_templates",
    {
      title: "List applet templates",
      description: `Lists the applet templates available for scaffolding a new applet.

An applet is an HTML page Glia embeds in the operator console. Templates come in
two shapes: a plain HTML page, and a React project that needs a build step. Some
templates also ship a backend function, indicated by hasBackendFunction.

Start here, then gf_get_applet_template for details and
gf_generate_applet_from_template to produce the code.`,
      inputSchema: {}
    },
    async () => {
      try {
        const templates = await listTemplates({ type: 'applet' });

        const result = {
          templates: templates.map(t => ({
            name: t.name,
            displayName: t.displayName || t.name,
            description: t.description || '',
            type: t.type,
            variables: t.variables || {},
            files: (t.files || []).map(f => f.destination),
            hasBackendFunction: t.files?.some(f => f.destination.includes('function.js')) || false
          })),
          count: templates.length
        };

        return textResult(result);
      } catch (error) {
        return errorResult(`Failed to list applet templates: ${error.message}`);
      }
    }
  );
}

/**
 * Get detailed template information
 */
export function registerGetAppletTemplate(server) {
  server.registerTool(
    "gf_get_applet_template",
    {
      title: "Get applet template details",
      description: `Gets one applet template: its variables, its file list, and a sample of its code.

Read this before generating, so you know which variables the template requires
and whether it also produces a function that has to be deployed separately.

sampleCode is the first 50 lines of the template's applet.html, which is usually
enough to judge whether the template fits.`,
      inputSchema: {
      templateName: z.string().describe("Template name (e.g., 'basic-html', 'react-app')")
    }
    },
    async ({ templateName }) => {
      try {
        const template = await getTemplate(templateName, 'applet');

        if (!template) {
          return errorResult(`Template '${templateName}' not found. Use gf_list_applet_templates to see available templates.`);
        }

        // Extract sample code (first 50 lines of main applet file)
        let sampleCode = '';
        const appletFile = template.files?.find(f => f.destination === 'applet.html');
        if (appletFile) {
          const templatePath = path.resolve(template.path, appletFile.source);
          if (fs.existsSync(templatePath)) {
            const content = fs.readFileSync(templatePath, 'utf8');
            const lines = content.split('\n');
            sampleCode = lines.slice(0, Math.min(50, lines.length)).join('\n');
            if (lines.length > 50) {
              sampleCode += '\n... (truncated)';
            }
          }
        }

        const result = {
          name: template.name,
          displayName: template.displayName || template.name,
          description: template.description || '',
          type: template.type,
          variables: template.variables || {},
          files: template.files || [],
          environmentVariables: template.environmentVariables || {},
          projectManifest: template.projectManifest,
          sampleCode,
          recommendedEnvVars: template.environmentVariables || {},
          nextSteps: [
            `Use gf_generate_applet_from_template to create applet code`,
            `Review and modify the generated HTML as needed`,
            `Deploy with gf_deploy_applet`
          ]
        };

        return textResult(result);
      } catch (error) {
        return errorResult(`Failed to get template: ${error.message}`);
      }
    }
  );
}

/**
 * Generate applet from template with variable substitution
 */
export function registerGenerateAppletFromTemplate(server) {
  server.registerTool(
    "gf_generate_applet_from_template",
    {
      title: "Generate applet code from a template",
      description: `Renders a template into applet code, in memory. Nothing is written to disk or deployed.

Returns appletHtml, and functionCode when the template includes a backend
function. Review the output, then deploy: the function first with
gf_create_function and gf_create_version, then the applet with gf_deploy_applet.

Required variables come from gf_get_applet_template; missing ones are reported
rather than silently left as placeholders.`,
      inputSchema: {
      templateName: z.string().describe("Template name (e.g., 'basic-html', 'react-app')"),
      appletName: z.string().describe("Name for the applet"),
      description: z.string().optional().describe("Applet description"),
      authorName: z.string().optional().describe("Author's name"),
      variablesJson: z.string().optional().describe("JSON string of additional template variables")
    }
    },
    async ({ templateName, appletName, description, authorName, variablesJson }) => {
      try {
        // Prepare variables
        const variables = {
          appletName,
          projectName: appletName,
          description: description || `A Glia applet created from ${templateName} template`,
          authorName: authorName || ''
        };

        // Add additional variables if provided
        if (variablesJson) {
          try {
            const additionalVars = JSON.parse(variablesJson);
            Object.assign(variables, additionalVars);
          } catch (e) {
            return errorResult("variablesJson must be valid JSON");
          }
        }

        // Get template and validate variables
        const template = await getTemplate(templateName, 'applet');

        if (!template) {
          return errorResult(`Template '${templateName}' not found. Use gf_list_applet_templates to see available templates.`);
        }

        const validation = validateTemplateVariables(template, variables);

        if (!validation.valid) {
          return errorResult(`Invalid template variables: ${validation.errors.join(', ')}`);
        }

        // Generate files in memory (don't write to disk)
        const files = {};
        let appletHtml = '';
        let functionCode = '';

        for (const file of template.files) {
          const sourcePath = path.resolve(template.path, file.source);

          if (!fs.existsSync(sourcePath)) {
            console.error(`Warning: Template file not found: ${sourcePath}`);
            continue;
          }

          let content = fs.readFileSync(sourcePath, 'utf8');

          // Apply template substitution if needed
          if (file.template) {
            const templateFn = Handlebars.compile(content);
            content = templateFn(variables);
          }

          files[file.destination] = content;

          // Extract specific files
          if (file.destination === 'applet.html') {
            appletHtml = content;
          } else if (file.destination === 'function.js') {
            functionCode = content;
          }
        }

        const result = {
          appletHtml,
          functionCode: functionCode || undefined,
          files,
          manifest: template.projectManifest,
          recommendedEnvVars: template.environmentVariables || {},
          nextSteps: [
            `Review the generated applet HTML`,
            functionCode ? `Deploy the function first with gf_create_function and gf_create_version` : null,
            `Deploy the applet with gf_deploy_applet`,
            `Test the applet in Glia`
          ].filter(Boolean),
          templateUsed: templateName
        };

        return textResult(result);
      } catch (error) {
        return errorResult(`Failed to generate applet: ${error.message}`);
      }
    }
  );
}

/**
 * List deployed applets on a site
 */
export function registerListApplets(server) {
  server.registerTool(
    "gf_list_applets",
    {
      title: "List deployed applets",
      description: `Lists the applets deployed on a site.

Defaults to the configured site. Returns id, name, scope and timestamps; pass
verbose for the full records.

Requires the applets:read permission. Without it this returns an empty list and
says so, rather than failing, so a missing permission is distinguishable from a
site with no applets.`,
      inputSchema: {
      siteId: z.string().optional().describe("Filter by site ID (defaults to current site)"),
      scope: z.enum(["engagement", "global"]).optional().describe("Filter by scope"),
      verbose: z.boolean().optional().describe("Include full details")
    }
    },
    async ({ siteId, scope, verbose }) => {
      try {
        const { api, apiConfig } = await makeApiClient();

        const result = await api.listApplets({
          siteId: siteId || apiConfig.siteId,
          scope
        });

        const applets = result?.axons || result?.items || [];

        const response = {
          applets: verbose ? applets : applets.map(a => ({
            id: a.id,
            name: a.name,
            scope: a.scope,
            owner_site_id: a.owner_site_id,
            created_at: a.created_at,
            updated_at: a.updated_at
          })),
          count: applets.length,
          siteId: siteId || apiConfig.siteId
        };

        return textResult(response);
      } catch (error) {
        // Handle permission errors gracefully
        if (error.statusCode === 403) {
          return textResult({
            applets: [],
            count: 0,
            message: "No permission to view applets. Check API key has 'applets:read' or 'list:applets' permission."
          });
        }

        return errorResult(`Failed to list applets: ${error.message}`);
      }
    }
  );
}

/**
 * Get detailed information about a specific applet
 */
export function registerGetApplet(server) {
  server.registerTool(
    "gf_get_applet",
    {
      title: "Get applet details",
      description: `Gets one applet by id, including its scope and source URL.

Use gf_list_applets first if you do not have the id. The applet id is a UUID, not
a name.`,
      inputSchema: {
      appletId: z.string().describe("Applet ID (UUID)")
    }
    },
    async ({ appletId }) => {
      try {
        const { api } = await makeApiClient();
        const applet = await api.getApplet(appletId);

        return textResult(applet);
      } catch (error) {
        return errorResult(`Failed to get applet: ${error.message}`);
      }
    }
  );
}

/**
 * Deploy an applet to a Glia site
 */
export function registerDeployApplet(server) {
  server.registerTool(
    "gf_deploy_applet",
    {
      title: "Deploy an applet",
      description: `Uploads HTML and creates an applet on a site.

The HTML must be a complete document: content without a <!DOCTYPE html> or
<html> tag is rejected before anything is uploaded, since Glia embeds the page
as-is and a fragment fails silently in the console.

scope decides where it appears: "engagement" inside an engagement, "global"
outside one. Defaults to engagement.

To change an applet after deployment use gf_update_applet; deploying again
creates a second applet.`,
      inputSchema: {
      name: z.string().describe("Applet name"),
      description: z.string().optional().describe("Applet description"),
      ownerSiteId: z.string().describe("Site ID where applet will be deployed"),
      source: z.string().describe("HTML content for the applet"),
      scope: z.enum(["engagement", "global"]).optional().describe("Applet scope (defaults to 'engagement')")
    }
    },
    async ({ name, description, ownerSiteId, source, scope }) => {
      try {
        // Validate HTML content
        if (!source || source.trim().length === 0) {
          return errorResult("HTML content (source) is required and cannot be empty");
        }

        // Basic HTML validation
        const hasHtmlTag = source.includes('<html') || source.includes('<!DOCTYPE');
        if (!hasHtmlTag) {
          return errorResult(
            "HTML content does not look like a document: expected <!DOCTYPE html> and an <html> tag. Nothing was deployed."
          );
        }

        const { api } = await makeApiClient();

        const options = {
          name,
          description: description || `Deployed via MCP server`,
          ownerSiteId,
          source,
          scope: scope || 'engagement'
        };

        const applet = await api.createApplet(options);

        const result = {
          ...applet,
          deployed: true,
          nextSteps: [
            `Applet deployed successfully with ID: ${applet.id}`,
            `Test the applet in Glia by viewing an engagement`,
            applet.source_url ? `Applet accessible at: ${applet.source_url}` : null,
            `Update the applet with gf_update_applet if changes are needed`
          ].filter(Boolean)
        };

        return textResult(result);
      } catch (error) {
        return errorResult(`Failed to deploy applet: ${error.message}`);
      }
    }
  );
}

/**
 * Update an existing applet
 */
export function registerUpdateApplet(server) {
  server.registerTool(
    "gf_update_applet",
    {
      title: "Update an applet",
      description: `Updates an applet's name, description, scope or HTML content.

At least one field is required. Returns a summary of what changed, so the effect
is auditable.

Replacing source replaces the whole document; there is no partial update of
applet HTML.`,
      inputSchema: {
      appletId: z.string().describe("Applet ID to update"),
      name: z.string().optional().describe("New applet name"),
      description: z.string().optional().describe("New description"),
      source: z.string().optional().describe("New HTML content"),
      scope: z.enum(["engagement", "global"]).optional().describe("New scope")
    }
    },
    async ({ appletId, name, description, source, scope }) => {
      try {
        // Validate at least one field is provided
        if (!name && description === undefined && !source && !scope) {
          return errorResult("At least one field must be provided to update (name, description, source, or scope)");
        }

        const { api } = await makeApiClient();

        const options = {};
        const changes = [];

        if (name) {
          options.name = name;
          changes.push(`name → "${name}"`);
        }
        if (description !== undefined) {
          options.description = description;
          changes.push(`description updated`);
        }
        if (source) {
          options.source = source;
          changes.push(`HTML content updated`);
        }
        if (scope) {
          options.scope = scope;
          changes.push(`scope → "${scope}"`);
        }

        const applet = await api.updateApplet(appletId, options);

        const result = {
          ...applet,
          changesSummary: changes
        };

        return textResult(result);
      } catch (error) {
        return errorResult(`Failed to update applet: ${error.message}`);
      }
    }
  );
}

/**
 * Permanently delete an applet
 */
export function registerDeleteApplet(server) {
  server.registerTool(
    "gf_delete_applet",
    {
      title: "Delete an applet",
      description: `Permanently deletes an applet.

Destructive and not reversible. Requires confirm: true. Any site embedding this
applet stops showing it immediately.

Pass dryRun: true to see what would happen without changing anything.`,
      inputSchema: {
      appletId: z.string().describe("Applet ID to delete"),
      ...destructiveArgs(z)
    }
    },
    async ({ appletId, confirm, dryRun }) => {
      try {
        const gate = checkDestructiveGate({ confirm, dryRun }, `deleting applet ${appletId}`);
        if (gate) return gate;

        const { api } = await makeApiClient();

        await api.deleteApplet(appletId);

        const result = {
          success: true,
          appletId,
          deletedAt: new Date().toISOString(),
          message: `Applet ${appletId} has been permanently deleted`
        };

        return textResult(result);
      } catch (error) {
        return errorResult(`Failed to delete applet: ${error.message}`);
      }
    }
  );
}

/**
 * Register every applet tool.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server - MCP server
 */
export function registerAppletTools(server) {
  registerListAppletTemplates(server);
  registerGetAppletTemplate(server);
  registerGenerateAppletFromTemplate(server);
  registerListApplets(server);
  registerGetApplet(server);
  registerDeployApplet(server);
  registerUpdateApplet(server);
  registerDeleteApplet(server);
}

/**
 * @deprecated Use registerAppletTools.
 * @param {Object} server - MCP server
 */
export const registerAllAppletTools = registerAppletTools;
