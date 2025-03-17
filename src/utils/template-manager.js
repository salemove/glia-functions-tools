/**
 * Template Manager Utility
 * 
 * This utility provides operations for managing function templates,
 * including listing available templates and creating functions from templates.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

// Convert callback-based fs functions to Promise-based
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readDirAsync = promisify(fs.readdir);
const mkdirAsync = promisify(fs.mkdir);

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to templates directory
const templatesDir = path.resolve(__dirname, '../templates');

/**
 * Get the list of available templates
 * 
 * @returns {Promise<Object[]>} Array of template objects with name and description
 */
export async function listTemplates() {
    try {
        // Read all files in templates directory
        const templateFiles = await readDirAsync(templatesDir);
        
        // Filter for JavaScript files
        const jsFiles = templateFiles.filter(file => file.endsWith('.js'));
        
        // Read each file to extract description
        const templates = await Promise.all(jsFiles.map(async (file) => {
            const filePath = path.join(templatesDir, file);
            const content = await readFileAsync(filePath, 'utf8');
            
            // Extract the template name from filename (without extension)
            const name = path.basename(file, '.js');
            
            // Extract description from file content (if available)
            let description = 'Glia Function Template';
            const descriptionMatch = content.match(/\* This template (.*?)(?:\n|\r\n?)/);
            if (descriptionMatch && descriptionMatch[1]) {
                description = descriptionMatch[1].trim();
            }
            
            return {
                name,
                filename: file,
                description
            };
        }));
        
        return templates;
    } catch (error) {
        console.error('Error listing templates:', error);
        throw new Error(`Failed to list templates: ${error.message}`);
    }
}

/**
 * Get a specific template by name
 * 
 * @param {string} templateName - Name of the template
 * @returns {Promise<Object>} Template object with content and metadata
 */
export async function getTemplate(templateName) {
    try {
        // Ensure template name has .js extension
        const filename = templateName.endsWith('.js') ? templateName : `${templateName}.js`;
        const filePath = path.join(templatesDir, filename);
        
        // Check if template exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`Template "${templateName}" not found`);
        }
        
        // Read template content
        const content = await readFileAsync(filePath, 'utf8');
        
        return {
            name: templateName,
            filename,
            content
        };
    } catch (error) {
        console.error(`Error getting template "${templateName}":`, error);
        throw new Error(`Failed to get template: ${error.message}`);
    }
}

/**
 * Create a function file from a template
 * 
 * @param {string} templateName - Name of the template to use
 * @param {string} outputPath - Path where the function file will be created
 * @param {Object} options - Options for customizing the template
 * @returns {Promise<string>} Path to the created function file
 */
export async function createFromTemplate(templateName, outputPath, options = {}) {
    try {
        // Get template content
        const template = await getTemplate(templateName);
        let content = template.content;
        
        // Apply customizations (if any)
        if (options.functionName) {
            content = content.replace(/Template/g, options.functionName);
        }
        
        // Create directory if it doesn't exist
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            await mkdirAsync(dir, { recursive: true });
        }
        
        // Write the function file
        await writeFileAsync(outputPath, content, 'utf8');
        
        return outputPath;
    } catch (error) {
        console.error(`Error creating function from template "${templateName}":`, error);
        throw new Error(`Failed to create function from template: ${error.message}`);
    }
}

/**
 * Get recommended environment variables for a template
 * 
 * @param {string} templateName - Name of the template
 * @returns {Promise<Object>} Object containing recommended environment variables
 */
export async function getTemplateEnvVars(templateName) {
    // Define known environment variables for specific templates
    const templateEnvVars = {
        'api-integration': {
            API_KEY: 'your-api-key',
            API_URL: 'https://api.example.com/v1'
        },
        'ai-integration': {
            OPENAI_API_KEY: 'your-openai-api-key',
            MODEL: 'gpt-3.5-turbo',
            TEMPERATURE: '0.7',
            MAX_TOKENS: '500'
        }
    };
    
    // Return environment variables for the requested template or an empty object
    return templateEnvVars[templateName] || {};
}

export default {
    listTemplates,
    getTemplate,
    createFromTemplate,
    getTemplateEnvVars
};