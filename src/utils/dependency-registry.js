/**
 * Dependency Registry
 * 
 * This module provides a centralized registry for managing dependency versions
 * across templates. It helps maintain consistent dependency versions and prevents
 * version conflicts.
 */

/**
 * Core dependencies used across most projects
 */
export const CORE_DEPENDENCIES = {
  '@glia/functions-tools': 'latest'
};

/**
 * Test dependencies for different test frameworks
 */
export const TEST_DEPENDENCIES = {
  // Jest testing
  jest: {
    'jest': '^29.5.0'
  },
  // Testing with supertest for HTTP
  supertest: {
    'supertest': '^6.3.3'
  },
  // API mocking
  nock: {
    'nock': '^13.3.1'
  }
};

/**
 * Feature-specific dependencies
 */
export const FEATURE_DEPENDENCIES = {
  // API clients
  api: {
    'node-fetch': '^3.3.1'
  },
  // AI/ML
  ai: {
    'openai': '^3.3.0'
  },
  // AWS integration
  aws: {
    '@aws-sdk/client-s3': '^3.332.0',
    '@aws-sdk/client-dynamodb': '^3.332.0'
  },
  // Data validation
  validation: {
    'zod': '^3.21.4'
  },
  // Utility libraries
  utils: {
    'lodash-es': '^4.17.21',
    'date-fns': '^2.30.0'
  },
  // Crypto
  crypto: {
    'crypto-js': '^4.1.1'
  }
};

/**
 * Environment-specific configurations
 */
export const ENVIRONMENT_CONFIGS = {
  jest: {
    "jest": {
      "testEnvironment": "node",
      "transform": {},
      "testMatch": [
        "**/test/**/*.test.js"
      ]
    }
  },
  eslint: {
    "eslintConfig": {
      "extends": [
        "eslint:recommended"
      ],
      "parserOptions": {
        "ecmaVersion": 2022,
        "sourceType": "module"
      },
      "env": {
        "node": true,
        "es2022": true
      }
    }
  }
};

/**
 * Script collections for package.json
 */
export const SCRIPT_COLLECTIONS = {
  basic: {
    "test": "NODE_OPTIONS=--experimental-vm-modules npx jest",
    "build": "glia-functions build ./{{mainFile}}"
  },
  watch: {
    "build:watch": "glia-functions build:watch ./{{mainFile}}",
    "dev": "glia-functions dev --path ./{{mainFile}} --watch"
  },
  deploy: {
    "deploy": "npm run build && glia-functions create-version --function-id $FUNCTION_ID --path ./function-out.js --deploy"
  },
  invoke: {
    "invoke": "glia-functions invoke-function --function-id $FUNCTION_ID --payload '{}'",
    "logs": "glia-functions fetch-logs --function-id $FUNCTION_ID"
  },
  project: {
    "deploy": "glia-functions deploy-project",
    "deploy:dry-run": "glia-functions deploy-project --dry-run"
  },
  kv: {
    "kv:list": "glia-functions kv:list --namespace $KV_NAMESPACE",
    "kv:get": "glia-functions kv:get --namespace $KV_NAMESPACE --key",
    "kv:set": "glia-functions kv:set --namespace $KV_NAMESPACE --key --value"
  }
};

/**
 * Get dependencies for a specific feature
 * 
 * @param {string} feature - Feature name
 * @returns {Object} Dependencies object
 */
export function getDependenciesForFeature(feature) {
  return FEATURE_DEPENDENCIES[feature] || {};
}

/**
 * Get test dependencies for a specific framework
 * 
 * @param {string} framework - Test framework name
 * @returns {Object} Test dependencies object
 */
export function getTestDependencies(framework = 'jest') {
  return TEST_DEPENDENCIES[framework] || {};
}

/**
 * Get environment configuration for a specific tool
 * 
 * @param {string} tool - Tool name
 * @returns {Object} Environment configuration object
 */
export function getEnvironmentConfig(tool) {
  return ENVIRONMENT_CONFIGS[tool] || {};
}

/**
 * Get script collection for a specific feature
 * 
 * @param {string} feature - Feature name
 * @returns {Object} Script collection object
 */
export function getScripts(feature) {
  return SCRIPT_COLLECTIONS[feature] || {};
}

/**
 * Merge dependencies with version conflict resolution
 * 
 * @param {...Object} dependencySets - Dependency objects to merge
 * @returns {Object} Merged dependencies object
 */
export function mergeDependencies(...dependencySets) {
  const result = {};
  
  // Process each set of dependencies
  dependencySets.forEach(deps => {
    if (!deps || typeof deps !== 'object') return;
    
    Object.entries(deps).forEach(([name, version]) => {
      // Skip null or undefined versions
      if (version == null) return;
      
      // If dependency doesn't exist yet, add it
      if (!result[name]) {
        result[name] = version;
        return;
      }
      
      // Conflict resolution - choose the more specific version
      // For simplicity, we'll just keep the existing version for now
      // A more sophisticated version would use semver to compare versions
      // and choose the higher one, but that's beyond this example
    });
  });
  
  return result;
}

/**
 * Generate a complete set of dependencies for a project
 * 
 * @param {Object} options - Options for dependency generation
 * @param {Array<string>} options.features - Features to include
 * @param {string} options.testFramework - Test framework to use
 * @param {Object} options.additional - Additional dependencies to include
 * @returns {Object} Dependencies object with dependencies and devDependencies
 */
export function generateDependencies(options = {}) {
  const { features = [], testFramework = 'jest', additional = {} } = options;
  
  // Start with core dependencies
  const dependencies = { ...CORE_DEPENDENCIES };
  
  // Add feature dependencies
  features.forEach(feature => {
    Object.assign(dependencies, getDependenciesForFeature(feature));
  });
  
  // Add additional dependencies
  Object.assign(dependencies, additional.dependencies || {});
  
  // Set up devDependencies
  const devDependencies = {
    ...getTestDependencies(testFramework),
    ...(additional.devDependencies || {})
  };
  
  return {
    dependencies,
    devDependencies
  };
}

/**
 * Generate a complete package.json object
 * 
 * @param {Object} options - Options for package.json generation
 * @param {string} options.name - Project name
 * @param {string} options.description - Project description
 * @param {string} options.mainFile - Main file path
 * @param {Array<string>} options.features - Features to include
 * @param {Array<string>} options.scriptCollections - Script collections to include
 * @param {Object} options.variables - Template variables
 * @returns {Object} Complete package.json object
 */
export function generatePackageJson(options = {}) {
  const { 
    name = "glia-function",
    description = "A Glia Function",
    mainFile = "function.js",
    features = [],
    scriptCollections = ["basic", "watch", "deploy", "invoke"],
    variables = {}
  } = options;
  
  // Generate dependencies
  const { dependencies, devDependencies } = generateDependencies({
    features,
    ...options
  });
  
  // Generate scripts
  let scripts = {};
  scriptCollections.forEach(collection => {
    Object.assign(scripts, getScripts(collection));
  });
  
  // Process variables in scripts
  const processedScripts = {};
  Object.entries(scripts).forEach(([key, value]) => {
    let processed = value;
    Object.entries(variables).forEach(([varName, varValue]) => {
      processed = processed.replace(new RegExp(`{{${varName}}}`, 'g'), varValue);
    });
    processedScripts[key] = processed;
  });
  
  // Get environment configs
  const envConfigs = {};
  if (scriptCollections.includes('test')) {
    Object.assign(envConfigs, getEnvironmentConfig('jest'));
  }
  
  // Build the final package.json
  return {
    name,
    version: "0.1.0",
    description,
    type: "module",
    main: mainFile,
    scripts: processedScripts,
    keywords: [
      "glia",
      "functions",
      "serverless",
      ...features
    ],
    author: variables.author || "",
    license: "MIT",
    dependencies,
    devDependencies,
    ...envConfigs
  };
}

export default {
  CORE_DEPENDENCIES,
  TEST_DEPENDENCIES,
  FEATURE_DEPENDENCIES,
  ENVIRONMENT_CONFIGS,
  SCRIPT_COLLECTIONS,
  getDependenciesForFeature,
  getTestDependencies,
  getEnvironmentConfig,
  getScripts,
  mergeDependencies,
  generateDependencies,
  generatePackageJson
};