import { jest } from '@jest/globals';
import {
  validateFunctionName,
  validateFunctionId,
  validateFilePath,
  validateEnvironmentVariables,
  validateDateString,
  parseAndValidateJson
} from '../../../src/lib/validation.js';
import { ValidationError } from '../../../src/lib/errors.js';

describe('Validation utilities', () => {
  describe('validateFunctionName', () => {
    it('should accept valid function names', () => {
      const validNames = [
        'test-function',
        'my_function',
        'Function 123',
        'simple'
      ];
      
      validNames.forEach(name => {
        expect(() => validateFunctionName(name)).not.toThrow();
        expect(validateFunctionName(name)).toBe(name);
      });
    });
    
    it('should throw for missing function name', () => {
      expect(() => validateFunctionName()).toThrow(ValidationError);
      expect(() => validateFunctionName(null)).toThrow('Function name is required');
      expect(() => validateFunctionName(undefined)).toThrow('Function name is required');
    });
    
    it('should throw for non-string function name', () => {
      expect(() => validateFunctionName(123)).toThrow(ValidationError);
      expect(() => validateFunctionName({})).toThrow('Function name must be a string');
    });
    
    it('should throw for empty function name', () => {
      expect(() => validateFunctionName('')).toThrow(ValidationError);
      expect(() => validateFunctionName('   ')).toThrow('Function name cannot be empty');
    });
    
    it('should throw for invalid characters in function name', () => {
      const invalidNames = [
        'function@name',
        'function/name',
        'function!name',
        'function.name'
      ];
      
      invalidNames.forEach(name => {
        expect(() => validateFunctionName(name)).toThrow(ValidationError);
        expect(() => validateFunctionName(name)).toThrow(/must contain only alphanumeric/);
      });
    });
  });
  
  describe('validateFunctionId', () => {
    it('should accept valid function IDs', () => {
      const validIds = [
        'abc123',
        'function-id-123',
        'ID_WITH_UNDERSCORES',
        'id with spaces'
      ];
      
      validIds.forEach(id => {
        expect(() => validateFunctionId(id)).not.toThrow();
        expect(validateFunctionId(id)).toBe(id);
      });
    });
    
    it('should throw for missing function ID', () => {
      expect(() => validateFunctionId()).toThrow(ValidationError);
      expect(() => validateFunctionId(null)).toThrow('Function ID is required');
      expect(() => validateFunctionId(undefined)).toThrow('Function ID is required');
    });
    
    it('should throw for non-string function ID', () => {
      expect(() => validateFunctionId(123)).toThrow(ValidationError);
      expect(() => validateFunctionId({})).toThrow('Function ID must be a string');
    });
    
    it('should throw for empty function ID', () => {
      expect(() => validateFunctionId('')).toThrow(ValidationError);
      expect(() => validateFunctionId('   ')).toThrow('Function ID cannot be empty');
    });
  });
  
  describe('validateFilePath', () => {
    it('should accept valid file paths', () => {
      const validPaths = [
        './file.js',
        '/absolute/path/file.js',
        'relative/path/file.js',
        'C:\\Windows\\Path\\file.js'
      ];
      
      validPaths.forEach(path => {
        expect(() => validateFilePath(path)).not.toThrow();
        expect(validateFilePath(path)).toBe(path);
      });
    });
    
    it('should throw for missing file path', () => {
      expect(() => validateFilePath()).toThrow(ValidationError);
      expect(() => validateFilePath(null)).toThrow('File path is required');
      expect(() => validateFilePath(undefined)).toThrow('File path is required');
    });
    
    it('should throw for non-string file path', () => {
      expect(() => validateFilePath(123)).toThrow(ValidationError);
      expect(() => validateFilePath({})).toThrow('File path must be a string');
    });
    
    it('should throw for empty file path', () => {
      expect(() => validateFilePath('')).toThrow(ValidationError);
      expect(() => validateFilePath('   ')).toThrow('File path cannot be empty');
    });
  });
  
  describe('validateEnvironmentVariables', () => {
    it('should accept valid environment variables', () => {
      const validEnvs = [
        { KEY: 'value' },
        { API_KEY: 'abc123', API_SECRET: 'xyz789' },
        {}
      ];
      
      validEnvs.forEach(env => {
        expect(() => validateEnvironmentVariables(env)).not.toThrow();
        expect(validateEnvironmentVariables(env)).toBe(env);
      });
    });
    
    it('should throw for missing or non-object environment variables', () => {
      expect(() => validateEnvironmentVariables()).toThrow(ValidationError);
      expect(() => validateEnvironmentVariables(null)).toThrow('Environment variables must be an object');
      expect(() => validateEnvironmentVariables('string')).toThrow('Environment variables must be an object');
      expect(() => validateEnvironmentVariables(123)).toThrow('Environment variables must be an object');
    });
    
    it('should throw for non-string environment variable values', () => {
      const invalidEnvs = [
        { KEY: 123 },
        { KEY1: 'string', KEY2: {} },
        { KEY: true }
      ];
      
      invalidEnvs.forEach(env => {
        expect(() => validateEnvironmentVariables(env)).toThrow(ValidationError);
        expect(() => validateEnvironmentVariables(env)).toThrow(/value must be a string/);
      });
    });
  });
  
  describe('validateDateString', () => {
    it('should accept valid date strings', () => {
      const validDates = [
        '2023-01-01',
        '2023-12-31',
        '2025-02-28',
        'latest'
      ];
      
      validDates.forEach(date => {
        expect(() => validateDateString(date)).not.toThrow();
        expect(validateDateString(date)).toBe(date);
      });
    });
    
    it('should throw for missing date string', () => {
      expect(() => validateDateString()).toThrow(ValidationError);
      expect(() => validateDateString(null)).toThrow('Date string is required');
      expect(() => validateDateString(undefined)).toThrow('Date string is required');
    });
    
    it('should throw for invalid date format', () => {
      const invalidDates = [
        '01-01-2023',
        '2023/01/01',
        '1-1-2023',
        '2023-1-1',
        'January 1, 2023',
        '20230101'
      ];
      
      invalidDates.forEach(date => {
        expect(() => validateDateString(date)).toThrow(ValidationError);
        expect(() => validateDateString(date)).toThrow('Date must be in YYYY-MM-DD format');
      });
    });
    
    it('should throw for invalid dates', () => {
      const invalidDates = [
        '2023-02-30', // February doesn't have 30 days
        '2023-13-01', // No month 13
        '2023-00-01', // No month 0
        '2023-01-00', // No day 0
        '2023-01-32'  // January doesn't have 32 days
      ];
      
      invalidDates.forEach(date => {
        expect(() => validateDateString(date)).toThrow(ValidationError);
      });
    });
  });
  
  describe('parseAndValidateJson', () => {
    it('should parse valid JSON strings', () => {
      const validJsons = [
        '{"key": "value"}',
        '[]',
        '{"nested": {"object": true}, "array": [1, 2, 3]}',
        '"string"',
        '123',
        'true',
        'null'
      ];
      
      validJsons.forEach(json => {
        expect(() => parseAndValidateJson(json)).not.toThrow();
        expect(parseAndValidateJson(json)).toEqual(JSON.parse(json));
      });
    });
    
    it('should throw for missing JSON string', () => {
      expect(() => parseAndValidateJson()).toThrow(ValidationError);
      expect(() => parseAndValidateJson(null)).toThrow('JSON string is required');
      expect(() => parseAndValidateJson(undefined)).toThrow('JSON string is required');
    });
    
    it('should throw for invalid JSON format', () => {
      const invalidJsons = [
        '{key: "value"}',
        '{"unclosed": "string"',
        '["unclosed" array]',
        '{"invalid": undefined}',
        '{"trailing": "comma",}',
        '{"attribute" : }'
      ];
      
      invalidJsons.forEach(json => {
        expect(() => parseAndValidateJson(json)).toThrow(ValidationError);
        expect(() => parseAndValidateJson(json)).toThrow('Invalid JSON format');
      });
    });
  });
});
