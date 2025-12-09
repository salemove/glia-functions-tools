import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
/**
 * Tests for code validator utility
 */

import { validateCode, validateMultiple } from '../../../src/utils/code-validator.js';

describe('Code Validator', () => {
    describe('validateCode', () => {
        test('should validate correct function code', async () => {
            const code = `
export async function onInvoke(request, env) {
    const data = await request.json();
    return Response.json({ success: true, data });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.valid).toBe(true);
            expect(result.hasOnInvoke).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.estimatedSize).toBeGreaterThan(0);
        });

        test('should detect missing onInvoke export', async () => {
            const code = `
function handler(request, env) {
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.valid).toBe(false);
            expect(result.hasOnInvoke).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    message: expect.stringContaining('Missing required export'),
                })
            );
        });

        test('should detect syntax errors', async () => {
            const code = `
export async function onInvoke(request, env) {
    const data = await request.json(
    return Response.json({ data });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should detect eval usage', async () => {
            const code = `
export async function onInvoke(request, env) {
    const code = "console.log('test')";
    eval(code);
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    message: expect.stringContaining('eval()'),
                })
            );
        });

        test('should detect synchronous file operations', async () => {
            const code = `
export async function onInvoke(request, env) {
    const data = fs.readFileSync('./data.json');
    return Response.json({ data });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    message: expect.stringContaining('Synchronous file system'),
                })
            );
        });

        test('should detect process.exit usage', async () => {
            const code = `
export async function onInvoke(request, env) {
    if (error) {
        process.exit(1);
    }
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    message: expect.stringContaining('process.exit()'),
                })
            );
        });

        test('should warn about non-async onInvoke', async () => {
            const code = `
export function onInvoke(request, env) {
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.hasOnInvoke).toBe(true);
            expect(result.warnings).toContain('onInvoke function should be declared as async');
        });

        test('should warn about missing error handling', async () => {
            const code = `
export async function onInvoke(request, env) {
    const data = await request.json();
    const result = await fetch('https://api.example.com');
    return Response.json({ result });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.warnings).toContain(
                'Async function without try-catch - consider adding error handling'
            );
        });

        test('should warn about excessive console.log', async () => {
            const code = `
export async function onInvoke(request, env) {
    console.log('step 1');
    console.log('step 2');
    console.log('step 3');
    console.log('step 4');
    console.log('step 5');
    console.log('step 6');
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.warnings).toContainEqual(
                expect.stringContaining('console.log statements')
            );
        });

        test('should detect debugger statement in strict mode', async () => {
            const code = `
export async function onInvoke(request, env) {
    debugger;
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code, { strict: true });

            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    message: expect.stringContaining('debugger statement'),
                })
            );
        });

        test('should warn about debugger statement in non-strict mode', async () => {
            const code = `
export async function onInvoke(request, env) {
    debugger;
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code, { strict: false });

            expect(result.warnings).toContainEqual(
                expect.stringContaining('debugger statement')
            );
        });

        test('should warn about missing Response object', async () => {
            const code = `
export async function onInvoke(request, env) {
    return { success: true };
}
            `.trim();

            const result = await validateCode(code);

            expect(result.warnings).toContainEqual(
                expect.stringContaining('should return a Response object')
            );
        });

        test('should warn about setTimeout without cleanup', async () => {
            const code = `
export async function onInvoke(request, env) {
    setTimeout(() => {
        console.log('delayed');
    }, 1000);
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.warnings).toContainEqual(
                expect.stringContaining('setTimeout/setInterval detected without cleanup')
            );
        });

        test('should estimate bundle size', async () => {
            const code = `
export async function onInvoke(request, env) {
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.estimatedSize).toBeGreaterThan(0);
            expect(result.estimatedSize).toBeLessThan(1024 * 1024); // Less than 1MB
        });

        test('should reject empty code', async () => {
            const result = await validateCode('');

            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    message: 'Code is empty',
                })
            );
        });

        test('should handle different onInvoke export patterns', async () => {
            const patterns = [
                'export async function onInvoke(request, env) { return Response.json({}); }',
                'export const onInvoke = async (request, env) => { return Response.json({}); };',
                'async function onInvoke(request, env) { return Response.json({}); } export { onInvoke };',
            ];

            for (const code of patterns) {
                const result = await validateCode(code);
                expect(result.hasOnInvoke).toBe(true);
            }
        });

        test('should validate code with imports', async () => {
            const code = `
import { someUtil } from './utils.js';

export async function onInvoke(request, env) {
    const result = someUtil();
    return Response.json({ result });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.hasOnInvoke).toBe(true);
            // May have warnings about missing utils.js, but should parse
        });

        test('should handle complex async patterns', async () => {
            const code = `
export async function onInvoke(request, env) {
    try {
        const data = await request.json();

        const results = await Promise.all([
            fetch('https://api1.example.com'),
            fetch('https://api2.example.com'),
        ]);

        return Response.json({
            success: true,
            data: results
        });
    } catch (error) {
        return Response.json({
            error: error.message
        }, { status: 500 });
    }
}
            `.trim();

            const result = await validateCode(code);

            expect(result.valid).toBe(true);
            expect(result.hasOnInvoke).toBe(true);
        });

        test('should warn about missing await on fetch', async () => {
            const code = `
export async function onInvoke(request, env) {
    fetch('https://api.example.com');
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.warnings).toContainEqual(
                expect.stringContaining('missing await')
            );
        });

        test('should suggest optional chaining', async () => {
            const code = `
export async function onInvoke(request, env) {
    const data = obj.prop && obj.prop.nested;
    return Response.json({ data });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.warnings).toContainEqual(
                expect.stringContaining('optional chaining')
            );
        });
    });

    describe('validateMultiple', () => {
        test('should validate multiple code snippets', async () => {
            const snippets = [
                {
                    name: 'valid-function',
                    code: 'export async function onInvoke(request, env) { return Response.json({}); }',
                },
                {
                    name: 'invalid-function',
                    code: 'function handler() { return {}; }',
                },
            ];

            const results = await validateMultiple(snippets);

            expect(results).toHaveLength(2);
            expect(results[0].name).toBe('valid-function');
            expect(results[0].valid).toBe(true);
            expect(results[1].name).toBe('invalid-function');
            expect(results[1].valid).toBe(false);
        });

        test('should handle snippets without names', async () => {
            const snippets = [
                {
                    code: 'export async function onInvoke(request, env) { return Response.json({}); }',
                },
            ];

            const results = await validateMultiple(snippets);

            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('unnamed');
        });
    });

    describe('Edge Cases', () => {
        test('should handle very large code', async () => {
            // Generate large code
            const largeArray = Array(1000).fill('console.log("test");').join('\n');
            const code = `
export async function onInvoke(request, env) {
    ${largeArray}
    return Response.json({ success: true });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.estimatedSize).toBeGreaterThan(0);
        });

        test('should handle code with special characters', async () => {
            const code = `
export async function onInvoke(request, env) {
    const message = "Hello 世界 🌍";
    return Response.json({ message });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.valid).toBe(true);
        });

        test('should handle multiline strings', async () => {
            const code = `
export async function onInvoke(request, env) {
    const html = \`
        <html>
            <body>
                <h1>Hello World</h1>
            </body>
        </html>
    \`;
    return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
    });
}
            `.trim();

            const result = await validateCode(code);

            expect(result.valid).toBe(true);
        });
    });
});
