/**
 * Code validation utility for Glia Functions
 *
 * Validates JavaScript code before deployment to catch errors early
 * and ensure code follows Glia Functions patterns.
 */

import { build } from 'esbuild';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

/**
 * Validates Glia Function code
 *
 * @param {string} code - The JavaScript code to validate
 * @param {object} options - Validation options
 * @param {boolean} options.strict - Enable strict validation (default: false)
 * @returns {Promise<object>} Validation result
 */
export async function validateCode(code, options = {}) {
    const { strict = false } = options;

    const result = {
        valid: true,
        errors: [],
        warnings: [],
        estimatedSize: 0,
        hasOnInvoke: false,
    };

    // 1. Check for empty code
    if (!code || code.trim().length === 0) {
        result.valid = false;
        result.errors.push({
            line: 0,
            message: 'Code is empty',
            severity: 'error',
        });
        return result;
    }

    // 2. Check for onInvoke export (do this before syntax check)
    const onInvokeCheck = checkOnInvokeExport(code);
    result.hasOnInvoke = onInvokeCheck.found;
    if (!onInvokeCheck.found) {
        result.valid = false;
        result.errors.push({
            line: 0,
            message: 'Missing required export: async function onInvoke(request, env)',
            severity: 'error',
        });
    }
    if (onInvokeCheck.warnings.length > 0) {
        result.warnings.push(...onInvokeCheck.warnings);
    }

    // 3. Check for common anti-patterns (always run, even if syntax fails)
    const antiPatterns = checkAntiPatterns(code, strict);
    result.warnings.push(...antiPatterns.warnings);
    result.errors.push(...antiPatterns.errors);
    if (antiPatterns.errors.length > 0) {
        result.valid = false;
    }

    // 4. Check for potential runtime errors
    const runtimeChecks = checkRuntimeIssues(code);
    result.warnings.push(...runtimeChecks.warnings);
    if (runtimeChecks.errors.length > 0) {
        result.errors.push(...runtimeChecks.errors);
        result.valid = false;
    }

    // 5. Syntax validation using esbuild (run last, as it's most expensive)
    const syntaxValidation = await validateSyntax(code);
    if (!syntaxValidation.valid) {
        result.valid = false;
        result.errors.push(...syntaxValidation.errors);
    }
    result.estimatedSize = syntaxValidation.bundleSize;

    return result;
}

/**
 * Validates JavaScript syntax using esbuild
 *
 * @param {string} code - Code to validate
 * @returns {Promise<object>} Syntax validation result
 */
async function validateSyntax(code) {
    const result = {
        valid: true,
        errors: [],
        bundleSize: 0,
    };

    // Create temporary file for esbuild
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `glia-validate-${Date.now()}.js`);
    const outFile = path.join(tmpDir, `glia-validate-${Date.now()}-out.js`);

    try {
        // Write code to temp file
        await fs.writeFile(tmpFile, code, 'utf8');

        // Try to build with esbuild
        await build({
            entryPoints: [tmpFile],
            bundle: true,
            write: true,
            outfile: outFile,
            platform: 'browser',
            format: 'esm',
            target: 'es2020',
            logLevel: 'silent',
        });

        // Get bundle size
        const stats = await fs.stat(outFile);
        result.bundleSize = stats.size;

        // Check if bundle size is too large (1MB limit)
        if (result.bundleSize > 1024 * 1024) {
            result.errors.push({
                line: 0,
                message: `Bundle size (${formatBytes(result.bundleSize)}) exceeds 1MB limit`,
                severity: 'error',
            });
            result.valid = false;
        }

    } catch (error) {
        result.valid = false;

        // Parse esbuild errors
        if (error.errors && error.errors.length > 0) {
            for (const err of error.errors) {
                result.errors.push({
                    line: err.location?.line || 0,
                    message: err.text,
                    severity: 'error',
                });
            }
        } else {
            result.errors.push({
                line: 0,
                message: error.message || 'Syntax validation failed',
                severity: 'error',
            });
        }
    } finally {
        // Clean up temp files
        try {
            await fs.unlink(tmpFile);
        } catch (e) {
            // Ignore cleanup errors
        }
        try {
            await fs.unlink(outFile);
        } catch (e) {
            // Ignore cleanup errors
        }
    }

    return result;
}

/**
 * Checks if code exports onInvoke function
 *
 * @param {string} code - Code to check
 * @returns {object} Check result
 */
function checkOnInvokeExport(code) {
    const result = {
        found: false,
        warnings: [],
    };

    // Check for various export patterns
    const patterns = [
        // export async function onInvoke
        /export\s+async\s+function\s+onInvoke\s*\(/,
        // export function onInvoke (could be non-async, which is a warning)
        /export\s+function\s+onInvoke\s*\(/,
        // export const onInvoke = async
        /export\s+const\s+onInvoke\s*=\s*async/,
        // export { onInvoke }
        /export\s*\{\s*onInvoke\s*\}/,
    ];

    for (const pattern of patterns) {
        if (pattern.test(code)) {
            result.found = true;
            break;
        }
    }

    // Check for non-async onInvoke (warning)
    if (/export\s+function\s+onInvoke\s*\(/.test(code) &&
        !/export\s+async\s+function\s+onInvoke\s*\(/.test(code)) {
        result.warnings.push('onInvoke function should be declared as async');
    }

    // Check for correct parameters
    if (result.found) {
        const paramCheck = /onInvoke\s*\(\s*(\w+)\s*,\s*(\w+)/;
        const match = code.match(paramCheck);
        if (!match) {
            result.warnings.push('onInvoke should accept (request, env) parameters');
        }
    }

    return result;
}

/**
 * Checks for common anti-patterns
 *
 * @param {string} code - Code to check
 * @param {boolean} strict - Strict mode
 * @returns {object} Anti-pattern check result
 */
function checkAntiPatterns(code, strict) {
    const result = {
        warnings: [],
        errors: [],
    };

    // Check for console.log in production code (warning)
    const consoleLogMatches = code.match(/console\.log/g);
    if (consoleLogMatches && consoleLogMatches.length > 5) {
        result.warnings.push(`Found ${consoleLogMatches.length} console.log statements - consider using console.info/warn/error instead`);
    }

    // Check for debugger statements (error in strict mode)
    if (/debugger\s*;/.test(code)) {
        const msg = 'debugger statement found - remove before deployment';
        if (strict) {
            result.errors.push({
                line: 0,
                message: msg,
                severity: 'error',
            });
        } else {
            result.warnings.push(msg);
        }
    }

    // Check for eval usage (error)
    if (/\beval\s*\(/.test(code)) {
        result.errors.push({
            line: 0,
            message: 'eval() is dangerous and not recommended',
            severity: 'error',
        });
    }

    // Check for setTimeout/setInterval without cleanup (warning)
    if (/setTimeout|setInterval/.test(code) && !/clearTimeout|clearInterval/.test(code)) {
        result.warnings.push('setTimeout/setInterval detected without cleanup - may cause memory leaks');
    }

    // Check for synchronous file system operations (error)
    if (/fs\.(readFileSync|writeFileSync|existsSync)/.test(code)) {
        result.errors.push({
            line: 0,
            message: 'Synchronous file system operations are not supported in Glia Functions',
            severity: 'error',
        });
    }

    // Check for process.exit (error)
    if (/process\.exit/.test(code)) {
        result.errors.push({
            line: 0,
            message: 'process.exit() is not allowed in Glia Functions',
            severity: 'error',
        });
    }

    // Check for large inline JSON/data (warning)
    const longStrings = code.match(/"[^"]{1000,}"|'[^']{1000,}'/g);
    if (longStrings && longStrings.length > 0) {
        result.warnings.push('Large inline strings detected - consider using external data or KV store');
    }

    // Check for missing error handling in async functions
    if (/async\s+function/.test(code) && !/try\s*\{/.test(code)) {
        result.warnings.push('Async function without try-catch - consider adding error handling');
    }

    // Check for Response usage patterns
    if (!/Response\.(json|text|redirect)/.test(code) && !/new\s+Response/.test(code)) {
        result.warnings.push('Function should return a Response object (e.g., Response.json())');
    }

    return result;
}

/**
 * Checks for potential runtime errors
 *
 * @param {string} code - Code to check
 * @returns {object} Runtime check result
 */
function checkRuntimeIssues(code) {
    const result = {
        warnings: [],
        errors: [],
    };

    // Check for missing await on promises
    const suspiciousPromises = [
        /\.json\(\)\s*;/,  // .json() without await
        /fetch\([^)]+\)\s*;/, // fetch without await
        /api\.\w+\([^)]*\)\s*;/, // API calls without await
    ];

    for (const pattern of suspiciousPromises) {
        if (pattern.test(code)) {
            result.warnings.push('Possible missing await on Promise - ensure async operations are awaited');
            break;
        }
    }

    // Check for undefined variables (common typos)
    const commonVars = ['request', 'env', 'response'];
    for (const varName of commonVars) {
        const regex = new RegExp(`\\b${varName}\\b`, 'g');
        const matches = code.match(regex);
        if (!matches && /onInvoke/.test(code)) {
            result.warnings.push(`'${varName}' parameter not used in onInvoke - is this intentional?`);
        }
    }

    // Check for null/undefined access patterns
    if (/\w+\.\w+\s*&&\s*\w+\.\w+\.\w+/.test(code) || /\w+\s*&&\s*\w+\.\w+/.test(code)) {
        result.warnings.push('Consider using optional chaining (?.) for safer property access');
    }

    return result;
}

/**
 * Formats bytes to human-readable string
 *
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Validates multiple code snippets in batch
 *
 * @param {Array<{code: string, name?: string}>} codeSnippets - Array of code snippets to validate
 * @param {object} options - Validation options
 * @returns {Promise<Array<object>>} Array of validation results
 */
export async function validateMultiple(codeSnippets, options = {}) {
    const results = [];

    for (const snippet of codeSnippets) {
        const result = await validateCode(snippet.code, options);
        results.push({
            name: snippet.name || 'unnamed',
            ...result,
        });
    }

    return results;
}

export default validateCode;
