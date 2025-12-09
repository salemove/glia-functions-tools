/**
 * Tests for the templates command
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { command } from '../../../src/commands/templates.js';

describe('templates command', () => {
  it('should have correct command configuration', () => {
    // Verify command structure
    expect(command).toBeDefined();
    expect(command.name).toBe('templates');
    expect(command.alias).toBe('t');
    expect(command.description).toBeTruthy();
    expect(command.options.length).toBeGreaterThan(0);
    expect(typeof command.action).toBe('function');
    
    // Verify key options are present
    const optionNames = command.options.map(opt => opt.name);
    expect(optionNames).toContain('list');
    expect(optionNames).toContain('info');
    expect(optionNames).toContain('create');
    expect(optionNames).toContain('variables');
  });
});