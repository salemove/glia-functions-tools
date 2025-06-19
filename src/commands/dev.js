/**
 * Development server command for local function execution
 * 
 * This command runs a local development server that simulates the workerd runtime
 * environment, allowing you to test your Glia Functions locally before deployment.
 */

import path from 'path';
import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { Miniflare } from 'miniflare';
import BaseCommand from '../cli/base-command.js';
import { getApiConfig } from '../lib/config.js';
import { showInfo, showSuccess, showError, showWarning } from '../cli/error-handler.js';
import { watchFile } from 'fs';

// Create test page HTML - must use a function to avoid parsing issues
function createTestPageHtml(port, initialEnvironment = {}) {
  // Convert environment to JSON string for initial display
  const initialEnvJson = JSON.stringify(initialEnvironment, null, 2);

  const lines = [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<title>Glia Functions Tester</title>',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<script type="module" src="/improved-dark-mode.js"></script>',
    '<!-- Prism Design System -->',
    '<style>',
    '/* Prism Design System Tokens */',
    ':root {',
    '  /* Theme Toggle */',
    '  --gl-theme: light;',
    '  /* Base Color Palette */',
    '  /* Yellow */',
    '  --gl-color-yellow-900: #bf6b00;',
    '  --gl-color-yellow-800: #d97900;',
    '  --gl-color-yellow-700: #ff8e00;',
    '  --gl-color-yellow-600: #ff9e1f;',
    '  --gl-color-yellow-500: #ffae3d;',
    '  --gl-color-yellow-400: #ffbd5c;',
    '  --gl-color-yellow-300: #ffcd7a;',
    '  --gl-color-yellow-200: #ffdd99;',
    '  --gl-color-yellow-100: #ffecb7;',
    '  --gl-color-yellow-50: #ffedb0;',
    '  ',
    '  /* Green */',
    '  --gl-color-green-900: #006000;',
    '  --gl-color-green-800: #007f0e;',
    '  --gl-color-green-700: #18901c;',
    '  --gl-color-green-600: #34a02c;',
    '  --gl-color-green-500: #4fb13c;',
    '  --gl-color-green-400: #6bc14d;',
    '  --gl-color-green-300: #87d25e;',
    '  --gl-color-green-200: #a2e26f;',
    '  --gl-color-green-100: #bef280;',
    '  --gl-color-green-50: #e7f5e6;',
    '  ',
    '  /* Red */',
    '  --gl-color-red-900: #86003d;',
    '  --gl-color-red-800: #a80142;',
    '  --gl-color-red-700: #bc0f42;',
    '  --gl-color-red-600: #cf2b42;',
    '  --gl-color-red-500: #e34242;',
    '  --gl-color-red-400: #f65a43;',
    '  --gl-color-red-300: #ff7243;',
    '  --gl-color-red-200: #ff8a44;',
    '  --gl-color-red-100: #ffa744;',
    '  --gl-color-red-50: #fde3e8;',
    '  ',
    '  /* Blue */',
    '  --gl-color-blue-900: #1b3cc1;',
    '  --gl-color-blue-800: #0d5ee0;',
    '  --gl-color-blue-700: #0f6bff;',
    '  --gl-color-blue-600: #007fff;',
    '  --gl-color-blue-500: #1e90ff;',
    '  --gl-color-blue-400: #3da0ff;',
    '  --gl-color-blue-300: #5cb0ff;',
    '  --gl-color-blue-200: #7bc0ff;',
    '  --gl-color-blue-100: #99d0ff;',
    '  --gl-color-blue-50: #e3ecfb;',
    '  ',
    '  /* Purple */',
    '  --gl-color-purple-900: #2c0735;',
    '  --gl-color-purple-800: #4e148c;',
    '  --gl-color-purple-700: #5936bf;',
    '  --gl-color-purple-600: #6a51d3;',
    '  --gl-color-purple-500: #7b6ce7;',
    '  --gl-color-purple-400: #8c87fb;',
    '  --gl-color-purple-300: #9d9dfb;',
    '  --gl-color-purple-200: #afb3fb;',
    '  --gl-color-purple-100: #c1c9fb;',
    '  --gl-color-purple-50: #f2e5ff;',
    '  ',
    '  /* Gray */',
    '  --gl-color-gray-900: #2e2f32;',
    '  --gl-color-gray-800: #404449;',
    '  --gl-color-gray-700: #50575f;',
    '  --gl-color-gray-600: #616a75;',
    '  --gl-color-gray-500: #727d8a;',
    '  --gl-color-gray-400: #b6bbc1;',
    '  --gl-color-gray-300: #d3d6da;',
    '  --gl-color-gray-200: #dfe1e3;',
    '  --gl-color-gray-100: #f3f3f3;',
    '  --gl-color-gray-50: #f7f7f7;',
    '  ',
    '  /* Base Colors */',
    '  --gl-color-white: #ffffff;',
    '  --gl-color-black: #000000;',
    '  --gl-color-transparent: transparent;',
    '',
    '  /* Semantic Colors */',
    '  /* Border Colors */',
    '  --gl-color-border-info: var(--gl-color-purple-800);',
    '  --gl-color-border-attention: var(--gl-color-yellow-800);',
    '  --gl-color-border-success: var(--gl-color-green-800);',
    '  --gl-color-border-danger: var(--gl-color-red-800);',
    '  --gl-color-border-primary: var(--gl-color-blue-800);',
    '  --gl-color-border-secondary: var(--gl-color-purple-600);',
    '  --gl-color-border-default: var(--gl-color-gray-200);',
    '  --gl-color-border-strong: var(--gl-color-gray-400);',
    '  --gl-color-border-focus: var(--gl-color-blue-600);',
    '  --gl-color-border-disabled: var(--gl-color-gray-200);',
    '',
    '  /* Text Colors */',
    '  --gl-color-text-default: var(--gl-color-purple-900);',
    '  --gl-color-text-muted: var(--gl-color-gray-400);',
    '  --gl-color-text-neutral: var(--gl-color-gray-600);',
    '  --gl-color-text-inverse: var(--gl-color-white);',
    '  --gl-color-text-primary: var(--gl-color-blue-800);',
    '  --gl-color-text-secondary: var(--gl-color-purple-800);',
    '  --gl-color-text-danger: var(--gl-color-red-800);',
    '  --gl-color-text-success: var(--gl-color-green-800);',
    '  --gl-color-text-warning: var(--gl-color-yellow-800);',
    '  --gl-color-text-info: var(--gl-color-purple-800);',
    '  --gl-color-text-disabled: var(--gl-color-gray-400);',
    '  --gl-color-text-highlight: var(--gl-color-blue-500);',
    '',
    '  /* Background Colors */',
    '  --gl-color-bg-default: var(--gl-color-white);',
    '  --gl-color-bg-muted: var(--gl-color-gray-50);',
    '  --gl-color-bg-neutral: var(--gl-color-gray-100);',
    '  --gl-color-bg-danger: var(--gl-color-red-700);',
    '  --gl-color-bg-success: var(--gl-color-green-700);',
    '  --gl-color-bg-warning: var(--gl-color-yellow-700);',
    '  --gl-color-bg-info: var(--gl-color-purple-700);',
    '  --gl-color-bg-primary: var(--gl-color-blue-700);',
    '  --gl-color-bg-secondary: var(--gl-color-purple-700);',
    '  --gl-color-bg-contrast: var(--gl-color-purple-900);',
    '  --gl-color-bg-disabled: var(--gl-color-gray-100);',
    '',
    '  /* Subtle Background Colors */',
    '  --gl-color-bg-danger-subtle: var(--gl-color-red-50);',
    '  --gl-color-bg-success-subtle: var(--gl-color-green-50);',
    '  --gl-color-bg-warning-subtle: var(--gl-color-yellow-50);',
    '  --gl-color-bg-info-subtle: var(--gl-color-purple-50);',
    '  --gl-color-bg-primary-subtle: var(--gl-color-blue-50);',
    '  --gl-color-bg-secondary-subtle: var(--gl-color-purple-50);',
    '',
    '  /* Typography */',
    '  /* Font Families */',
    '  --gl-font-family-sans: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
    '  --gl-font-family-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;',
    '  --gl-font-family-display: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
    '  ',
    '  /* Font Sizes */',
    '  --gl-font-size-8: 28px;',
    '  --gl-font-size-7: 24px;',
    '  --gl-font-size-6: 20px;',
    '  --gl-font-size-5: 18px;',
    '  --gl-font-size-4: 16px;',
    '  --gl-font-size-3: 14px;',
    '  --gl-font-size-2: 12px;',
    '  --gl-font-size-1: 10px;',
    '',
    '  /* Line Heights */',
    '  --gl-line-height-tight: 1.2;',
    '  --gl-line-height-normal: 1.5;',
    '  --gl-line-height-relaxed: 1.75;',
    '  --gl-line-height-loose: 2;',
    '',
    '  /* Font Weights */',
    '  --gl-font-weight-light: 300;',
    '  --gl-font-weight-normal: 400;',
    '  --gl-font-weight-medium: 500;',
    '  --gl-font-weight-semibold: 600;',
    '  --gl-font-weight-bold: 700;',
    '  --gl-font-weight-extrabold: 800;',
    '  ',
    '  /* Letter Spacings */',
    '  --gl-letter-spacing-tight: -0.025em;',
    '  --gl-letter-spacing-normal: 0;',
    '  --gl-letter-spacing-wide: 0.025em;',
    '  --gl-letter-spacing-wider: 0.05em;',
    '',
    '  /* Spacing */',
    '  --gl-spacing-9: 64px;',
    '  --gl-spacing-8: 48px;',
    '  --gl-spacing-7: 40px;',
    '  --gl-spacing-6: 32px;',
    '  --gl-spacing-5: 24px;',
    '  --gl-spacing-4: 16px;',
    '  --gl-spacing-3: 12px;',
    '  --gl-spacing-2: 8px;',
    '  --gl-spacing-1: 4px;',
    '  --gl-spacing-0: 0;',
    '  --gl-spacing-auto: auto;',
    '',
    '  /* Border Radius */',
    '  --gl-radii-5: 9999px; /* pill */',
    '  --gl-radii-4: 16px;   /* xl */',
    '  --gl-radii-3: 8px;    /* lg */',
    '  --gl-radii-2: 6px;    /* md */',
    '  --gl-radii-1: 4px;    /* sm */',
    '  --gl-radii-0: 0;      /* none */',
    '',
    '  /* Box Shadows / Elevations */',
    '  --gl-elevation-3: 0 10px 30px 0 rgba(0, 0, 0, 0.2);  /* high */',
    '  --gl-elevation-2: 0 4px 16px 0 rgba(0, 0, 0, 0.24);  /* medium */',
    '  --gl-elevation-1: 0 8px 24px 0 rgba(0, 0, 0, 0.16);  /* low */',
    '  --gl-elevation-0: 0 0 0 0 rgba(0, 0, 0, 0);          /* none */',
    '  --gl-focus-ring: 0 0 0 3px var(--gl-color-blue-300);',
    '  --gl-inner-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);',
    '',
    '  /* Z-indices */',
    '  --gl-z-index-dropdown: 1000;',
    '  --gl-z-index-sticky: 1020;',
    '  --gl-z-index-fixed: 1030;',
    '  --gl-z-index-modal-backdrop: 1040;',
    '  --gl-z-index-modal: 1050;',
    '  --gl-z-index-popover: 1060;',
    '  --gl-z-index-tooltip: 1070;',
    '',
    '  /* Animation & Transitions */',
    '  --gl-transition-fast: 150ms;',
    '  --gl-transition-normal: 250ms;',
    '  --gl-transition-slow: 350ms;',
    '  --gl-transition-very-slow: 500ms;',
    '  --gl-easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);',
    '  --gl-easing-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);',
    '  --gl-easing-accelerate: cubic-bezier(0.4, 0.0, 1, 1);',
    '',
    '  /* Opacity */',
    '  --gl-opacity-0: 0;',
    '  --gl-opacity-25: 0.25;',
    '  --gl-opacity-50: 0.5;',
    '  --gl-opacity-75: 0.75;',
    '  --gl-opacity-100: 1;',
    '  ',
    '  /* Misc */',
    '  --gl-container-max-width: 1200px;',
    '  --gl-input-height: 40px;',
    '  --gl-input-height-sm: 32px;',
    '  --gl-input-height-lg: 48px;',
    '}',
    '',
    '/* Dark Mode Theme Variables */',
    '[data-theme="dark"] {',
    '  /* Set theme identifier */',
    '  --gl-theme: dark;',
    '  ',
    '  /* Text Colors */',
    '  --gl-color-text-default: var(--gl-color-white);',
    '  --gl-color-text-muted: var(--gl-color-gray-400);',
    '  --gl-color-text-neutral: var(--gl-color-gray-300);',
    '  --gl-color-text-inverse: var(--gl-color-gray-900);',
    '  --gl-color-text-primary: var(--gl-color-blue-300);',
    '  --gl-color-text-secondary: var(--gl-color-purple-300);',
    '  --gl-color-text-danger: var(--gl-color-red-300);',
    '  --gl-color-text-success: var(--gl-color-green-300);',
    '  --gl-color-text-warning: var(--gl-color-yellow-300);',
    '  --gl-color-text-info: var(--gl-color-purple-300);',
    '  --gl-color-text-disabled: var(--gl-color-gray-600);',
    '  --gl-color-text-highlight: var(--gl-color-blue-300);',
    '  ',
    '  /* Background Colors */',
    '  --gl-color-bg-default: var(--gl-color-gray-900);',
    '  --gl-color-bg-muted: var(--gl-color-gray-800);',
    '  --gl-color-bg-neutral: var(--gl-color-gray-700);',
    '  ',
    '  /* Border Colors */',
    '  --gl-color-border-default: var(--gl-color-gray-600);',
    '  --gl-color-border-strong: var(--gl-color-gray-500);',
    '  ',
    '  /* Box Shadows / Elevations */',
    '  --gl-elevation-3: 0 10px 30px 0 rgba(0, 0, 0, 0.5);',
    '  --gl-elevation-2: 0 4px 16px 0 rgba(0, 0, 0, 0.5);',
    '  --gl-elevation-1: 0 8px 24px 0 rgba(0, 0, 0, 0.5);',
    '  --gl-focus-ring: 0 0 0 3px var(--gl-color-blue-700);',
    '  ',
    '  /* Monaco Editor Colors */',
    '  --monaco-background: var(--gl-color-gray-900);',
    '  --monaco-foreground: var(--gl-color-gray-200);',
    '  --monaco-line-highlight: rgba(255, 255, 255, 0.1);',
    '  --monaco-selection: rgba(79, 84, 92, 0.4);',
    '}',
    '',
    '/* Base Styles */',
    'body { ',
    '  font-family: var(--gl-font-family-sans); ',
    '  margin: 0; ',
    '  padding: 0; ',
    '  color: var(--gl-color-text-default);',
    '  background-color: var(--gl-color-bg-muted);',
    '  font-size: var(--gl-font-size-3);',
    '  line-height: 1.5;',
    '}',
    '.container { ',
    '  max-width: 900px; ',
    '  margin: 0 auto; ',
    '  padding: var(--gl-spacing-4);',
    '}',
    '.header-bar {',
    '  background-color: var(--gl-color-purple-800);',
    '  color: var(--gl-color-white);',
    '  padding: var(--gl-spacing-3) 0;',
    '  margin-bottom: var(--gl-spacing-5);',
    '  box-shadow: var(--gl-elevation-1);',
    '}',
    '.header-bar h1 {',
    '  margin: 0;',
    '  color: var(--gl-color-white);',
    '}',
    '.tabs { ',
    '  display: flex; ',
    '  border-bottom: 1px solid var(--gl-color-border-default); ',
    '  margin-bottom: var(--gl-spacing-4);',
    '}',
    '.tab { ',
    '  padding: var(--gl-spacing-3) var(--gl-spacing-5); ',
    '  cursor: pointer; ',
    '  font-weight: 500;',
    '  border-bottom: 2px solid transparent;',
    '  color: var(--gl-color-text-neutral);',
    '  transition: all 0.2s;',
    '}',
    '.tab.active { ',
    '  border-bottom: 2px solid var(--gl-color-border-primary); ',
    '  color: var(--gl-color-text-primary);',
    '}',
    '.tab:hover:not(.active) {',
    '  color: var(--gl-color-text-default);',
    '  background-color: var(--gl-color-bg-neutral);',
    '}',
    '.tab:focus {',
    '  outline: 2px solid var(--gl-color-blue-600);',
    '  outline-offset: -2px;',
    '}',
    '.card {',
    '  background: var(--gl-color-bg-default);',
    '  border-radius: var(--gl-radii-2);',
    '  box-shadow: var(--gl-elevation-1);',
    '  margin-bottom: var(--gl-spacing-5);',
    '}',
    '.tab-content { ',
    '  display: none; ',
    '  padding: var(--gl-spacing-4); ',
    '}',
    '.tab-content.active { display: block; }',
    'textarea { ',
    '  width: 100%; ',
    '  height: 200px; ',
    '  font-family: var(--gl-font-family-mono);',
    '  border: 1px solid var(--gl-color-border-default);',
    '  border-radius: var(--gl-radii-1);',
    '  padding: var(--gl-spacing-3);',
    '  font-size: var(--gl-font-size-3);',
    '  resize: vertical;',
    '  box-sizing: border-box;',
    '}',
    'textarea:focus, input:focus, select:focus {',
    '  outline: none;',
    '  border-color: var(--gl-color-blue-600);',
    '  box-shadow: 0 0 0 2px var(--gl-color-blue-50);',
    '}',
    'pre { ',
    '  background: var(--gl-color-bg-neutral); ',
    '  padding: var(--gl-spacing-3); ',
    '  border-radius: var(--gl-radii-1);',
    '  overflow: auto; ',
    '  max-height: 400px; ',
    '  font-family: var(--gl-font-family-mono);',
    '  font-size: var(--gl-font-size-2);',
    '}',
    '.flex-row { ',
    '  display: flex; ',
    '  gap: var(--gl-spacing-3); ',
    '  align-items: center; ',
    '  margin-bottom: var(--gl-spacing-3);',
    '}',
    '.flex-grow { flex-grow: 1; }',
    '.notification { ',
    '  background: var(--gl-color-bg-primary-subtle); ',
    '  color: var(--gl-color-text-primary); ',
    '  padding: var(--gl-spacing-3); ',
    '  margin: var(--gl-spacing-3) 0; ',
    '  border-radius: var(--gl-radii-2); ',
    '  display: none; ',
    '  border-left: 4px solid var(--gl-color-border-primary);',
    '}',
    '.notification a {',
    '  color: var(--gl-color-text-primary);',
    '  font-weight: 500;',
    '}',
    '.history-item { ',
    '  cursor: pointer; ',
    '  padding: var(--gl-spacing-3); ',
    '  border: 1px solid var(--gl-color-border-default); ',
    '  border-radius: var(--gl-radii-1);',
    '  margin: var(--gl-spacing-2) 0;',
    '  transition: background-color 0.2s;',
    '}',
    '.history-item:hover { background-color: var(--gl-color-bg-neutral); }',
    '.env-group { margin-bottom: var(--gl-spacing-5); }',
    '.env-row { ',
    '  display: flex; ',
    '  gap: var(--gl-spacing-3); ',
    '  margin-bottom: var(--gl-spacing-2);',
    '}',
    '.env-row input { ',
    '  flex-grow: 1; ',
    '  padding: var(--gl-spacing-2);',
    '  border: 1px solid var(--gl-color-border-default);',
    '  border-radius: var(--gl-radii-1);',
    '  font-size: var(--gl-font-size-3);',
    '  font-family: var(--gl-font-family-sans);',
    '}',
    '.btn { ',
    '  padding: var(--gl-spacing-2) var(--gl-spacing-4); ',
    '  background: var(--gl-color-bg-primary); ',
    '  color: var(--gl-color-text-inverse); ',
    '  border: none; ',
    '  border-radius: var(--gl-radii-1); ',
    '  cursor: pointer;',
    '  font-weight: 500;',
    '  font-size: var(--gl-font-size-3);',
    '  font-family: var(--gl-font-family-sans);',
    '  transition: background-color 0.2s;',
    '  white-space: nowrap;',
    '}',
    '.btn:hover { background: var(--gl-color-blue-800); }',
    '.btn:focus {',
    '  outline: 2px solid var(--gl-color-blue-600);',
    '  outline-offset: 2px;',
    '}',
    '.btn-sm { ',
    '  padding: var(--gl-spacing-1) var(--gl-spacing-3); ',
    '  font-size: var(--gl-font-size-2);',
    '}',
    '.btn-danger { background: var(--gl-color-bg-danger); }',
    '.btn-danger:hover { background: var(--gl-color-red-800); }',
    '.form-group { margin-bottom: var(--gl-spacing-4); }',
    '.form-group label { ',
    '  display: block; ',
    '  margin-bottom: var(--gl-spacing-2); ',
    '  font-weight: 500;',
    '  color: var(--gl-color-text-default);',
    '}',
    'select { ',
    '  padding: var(--gl-spacing-2); ',
    '  border: 1px solid var(--gl-color-border-default); ',
    '  border-radius: var(--gl-radii-1); ',
    '  font-size: var(--gl-font-size-3);',
    '  background-color: var(--gl-color-bg-default);',
    '  min-width: 100px;',
    '}',
    'input[type="text"] { ',
    '  padding: var(--gl-spacing-2); ',
    '  border: 1px solid var(--gl-color-border-default); ',
    '  border-radius: var(--gl-radii-1); ',
    '  font-size: var(--gl-font-size-3);',
    '  width: 100%;',
    '  box-sizing: border-box;',
    '}',
    'h1 { ',
    '  color: var(--gl-color-text-default); ',
    '  margin-top: var(--gl-spacing-2);',
    '  margin-bottom: var(--gl-spacing-4);',
    '  font-size: 24px;',
    '  font-weight: 600;',
    '}',
    'h3 { ',
    '  margin-top: var(--gl-spacing-4);',
    '  margin-bottom: var(--gl-spacing-2);',
    '  font-weight: 600;',
    '  font-size: var(--gl-font-size-4);',
    '}',
    '.status-badge {',
    '  display: inline-block;',
    '  padding: 2px 8px;',
    '  border-radius: var(--gl-radii-5);',
    '  font-size: var(--gl-font-size-2);',
    '  font-weight: 500;',
    '}',
    '.status-success {',
    '  background: var(--gl-color-bg-success-subtle);',
    '  color: var(--gl-color-text-success);',
    '}',
    '.status-error {',
    '  background: var(--gl-color-bg-danger-subtle);',
    '  color: var(--gl-color-text-danger);',
    '}',
    '.btn-theme {',
    '  background: transparent;',
    '  padding: var(--gl-spacing-2);',
    '  border-radius: var(--gl-radii-5);',
    '  color: var(--gl-color-white);',
    '  font-size: var(--gl-font-size-4);',
    '  line-height: 1;',
    '  cursor: pointer;',
    '  border: none;',
    '  position: relative;',
    '  width: 40px;',
    '  height: 40px;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '}',
    '.btn-theme:hover {',
    '  background-color: rgba(255, 255, 255, 0.1);',
    '}',
    '.btn-theme:focus {',
    '  outline: 2px solid var(--gl-color-blue-600);',
    '  outline-offset: 2px;',
    '}',
    '.icon-light, .icon-dark {',
    '  position: absolute;',
    '  transition: opacity 0.3s ease, transform 0.3s ease;',
    '}',
    '[data-theme="dark"] .icon-light {',
    '  opacity: 1;',
    '  transform: scale(1);',
    '}',
    '[data-theme="dark"] .icon-dark {',
    '  opacity: 0;',
    '  transform: scale(0.5);',
    '}',
    '[data-theme="light"] .icon-light {',
    '  opacity: 0;',
    '  transform: scale(0.5);',
    '}',
    '[data-theme="light"] .icon-dark {',
    '  opacity: 1;',
    '  transform: scale(1);',
    '}',
    '.header-content {',
    '  display: flex;',
    '  justify-content: space-between;',
    '  align-items: center;',
    '  margin-bottom: 0;',
    '}',
    '@media (max-width: 768px) {',
    '  .tabs { flex-wrap: wrap; }',
    '  .tab { flex: 1 1 auto; text-align: center; }',
    '  .flex-row { flex-direction: column; align-items: stretch; }',
    '  .flex-row .btn { align-self: flex-start; }',
    '  .header-content { flex-direction: row; }',
    '}',
    '',
    '/* Monaco Editor Dark Mode Styles */',
    '[data-theme="dark"] .monaco-editor {',
    '  background-color: var(--monaco-background) !important;',
    '  color: var(--monaco-foreground) !important;',
    '}',
    '[data-theme="dark"] .monaco-editor .margin {',
    '  background-color: var(--gl-color-gray-800) !important;',
    '}',
    '[data-theme="dark"] .monaco-editor .line-numbers {',
    '  color: var(--gl-color-gray-400) !important;',
    '}',
    '[data-theme="dark"] .monaco-editor .current-line {',
    '  background-color: var(--monaco-line-highlight) !important;',
    '}',
    '[data-theme="dark"] .monaco-editor .selection {',
    '  background-color: var(--monaco-selection) !important;',
    '}',
    '</style>',
    '</head>',
    '<body>',
    '<div class="header-bar">',
    '  <div class="container">',
    '    <div class="flex-row header-content">',
    '      <h1>Glia Functions Test UI</h1>',
    '      <button id="theme-toggle" class="btn btn-theme" aria-label="Toggle dark mode">',
    '        <span class="icon-light">☀️</span>',
    '        <span class="icon-dark">🌙</span>',
    '      </button>',
    '    </div>',
    '  </div>',
    '</div>',
    '',
    '<div class="container">',
    '  <div id="rebuild-notification" class="notification" role="alert">',
    '    Function has been rebuilt! <a href="#" onclick="window.location.reload()">Reload page</a> to use the latest version.',
    '  </div>',
    '  ',
    '  <div class="tabs" role="tablist">',
    '    <div class="tab active" data-tab="request-tab" role="tab" aria-selected="true" tabindex="0">Request Builder</div>',
    '    <div class="tab" data-tab="env-tab" role="tab" aria-selected="false" tabindex="0">Environment Variables</div>',
    '    <div class="tab" data-tab="history-tab" role="tab" aria-selected="false" tabindex="0">Request History</div>',
    '    <div class="tab" data-tab="logs-tab" role="tab" aria-selected="false" tabindex="0">Logs</div>',
    '  </div>',
    '',
    '  <div id="request-tab" class="tab-content card active" role="tabpanel">',
    '    <div class="form-group">',
    '      <div class="flex-row">',
    '        <select id="method" aria-label="HTTP Method">',
    '          <option value="POST">POST</option>',
    '          <option value="GET">GET</option>',
    '          <option value="PUT">PUT</option>',
    '          <option value="DELETE">DELETE</option>',
    '        </select>',
    '        <input type="text" id="endpoint" value="/" class="flex-grow" placeholder="/endpoint-path" aria-label="Endpoint path" />',
    '        <button onclick="sendRequest()" class="btn">Send Request</button>',
    '      </div>',
    '    </div>',
    '    <div class="form-group">',
    '      <label for="payload">Request Payload</label>',
    '      <textarea id="payload">{"key": "value"}</textarea>',
    '    </div>',
    '    <div>',
    '      <h3>Response</h3>',
    '      <pre id="response" aria-live="polite">Response will appear here</pre>',
    '    </div>',
    '  </div>',
    '',
    '  <div id="env-tab" class="tab-content card" role="tabpanel">',
    '    <h3>Environment Variables</h3>',
    '    <p>These environment variables will be available to your function during execution.</p>',
    '    <div id="env-variables" class="env-group">',
    '      <!-- Environment variables will be added here -->',
    '    </div>',
    '    <div class="flex-row">',
    '      <button onclick="addEnvRow()" class="btn">Add Variable</button>',
    '      <button onclick="saveEnvironment()" class="btn">Save & Rebuild</button>',
    '    </div>',
    '  </div>',
    '',
    '  <div id="history-tab" class="tab-content card" role="tabpanel">',
    '    <h3>Request History</h3>',
    '    <div id="history-list" aria-live="polite">',
    '      <!-- Request history items will be added here -->',
    '      <p>No requests yet. Send a request to add it to history.</p>',
    '    </div>',
    '  </div>',
    '',
    '  <div id="logs-tab" class="tab-content card" role="tabpanel">',
    '    <h3>Console Logs</h3>',
    '    <div class="flex-row">',
    '      <button onclick="clearLogs()" class="btn btn-sm">Clear Logs</button>',
    '    </div>',
    '    <pre id="logs" aria-live="polite">Loading logs...</pre>',
    '  </div>',
    '</div>',
    '',
    '<script>',
    '  // Load improved dark mode implementation',
    '  const script = document.createElement("script");',
    '  script.type = "module";',
    '  script.src = "/improved-dark-mode.js";',
    '  document.head.appendChild(script);',
    '',
    '  // Initial environment variables',
    '  let environment = ' + JSON.stringify(initialEnvJson) + ';',
    '  let requestHistory = [];',
    '',
    '  document.addEventListener("DOMContentLoaded", function() {',
    '    // Initialize theme',
    '    initializeTheme();',
    '    ',
    '    // Initialize tabs',
    '    setupTabs();',
    '    ',
    '    // Start polling',
    '    setInterval(pollLogs, 1000);',
    '    setInterval(checkForRebuild, 2000);',
    '    ',
    '    // Load environment variables',
    '    try {',
    '      const savedEnv = JSON.parse(' + JSON.stringify(initialEnvJson) + ');',
    '      updateEnvUI(savedEnv);',
    '    } catch (e) {',
    '      console.error("Error loading environment:", e);',
    '      updateEnvUI({});',
    '    }',
    '    ',
    '    // Load request history',
    '    try {',
    '      const savedHistory = localStorage.getItem("requestHistory");',
    '      if (savedHistory) {',
    '        requestHistory = JSON.parse(savedHistory);',
    '        updateHistoryUI();',
    '      }',
    '    } catch (e) {',
    '      console.error("Error loading history:", e);',
    '    }',
    '  });',
    '',
    '  // Theme management functions',
    '  function initializeTheme() {',
    '    // Set up theme toggle button',
    '    const themeToggle = document.getElementById("theme-toggle");',
    '    themeToggle.addEventListener("click", toggleTheme);',
    '    ',
    '    // Apply saved theme or detect system preference',
    '    applyTheme(getThemePreference());',
    '    ',
    '    // Watch for system preference changes',
    '    if (window.matchMedia) {',
    '      const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");',
    '      ',
    '      // Apply change if preference changes (and user hasn\'t manually set a preference)',
    '      colorSchemeQuery.addEventListener("change", (e) => {',
    '        const savedTheme = localStorage.getItem("theme");',
    '        if (!savedTheme) {',
    '          applyTheme(e.matches ? "dark" : "light");',
    '        }',
    '      });',
    '    }',
    '  }',
    '  ',
    '  function getThemePreference() {',
    '    // Check for saved preference',
    '    const savedTheme = localStorage.getItem("theme");',
    '    if (savedTheme) {',
    '      return savedTheme;',
    '    }',
    '    ',
    '    // Check system preference',
    '    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {',
    '      return "dark";',
    '    }',
    '    ',
    '    // Default to light',
    '    return "light";',
    '  }',
    '  ',
    '  function applyTheme(theme) {',
    '    document.documentElement.setAttribute("data-theme", theme);',
    '    localStorage.setItem("theme", theme);',
    '    ',
    '    // Update monaco editor theme if it exists (it may not be initialized yet)',
    '    if (window.monaco && window.monaco.editor) {',
    '      monaco.editor.setTheme(theme === "dark" ? "vs-dark" : "vs");',
    '    }',
    '  }',
    '  ',
    '  function toggleTheme() {',
    '    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";',
    '    const newTheme = currentTheme === "light" ? "dark" : "light";',
    '    applyTheme(newTheme);',
    '  }',
    '  ',
    '  function setupTabs() {',
    '    const tabs = document.querySelectorAll(".tab");',
    '    tabs.forEach(tab => {',
    '      tab.addEventListener("click", function() {',
    '        // Remove active class from all tabs and content',
    '        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));',
    '        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));',
    '        ',
    '        // Add active class to clicked tab',
    '        this.classList.add("active");',
    '        ',
    '        // Show corresponding content',
    '        const tabId = this.getAttribute("data-tab");',
    '        document.getElementById(tabId).classList.add("active");',
    '      });',
    '    });',
    '  }',
    '',
    '  function sendRequest() {',
    '    const method = document.getElementById("method").value;',
    '    const endpoint = document.getElementById("endpoint").value;',
    '    const payload = document.getElementById("payload").value;',
    '    ',
    '    // Build URL - hardcoded to the same origin',
    '    const base = location.protocol + "//" + location.host;',
    '    const url = endpoint.startsWith("/") ? base + endpoint : base + "/" + endpoint;',
    '    ',
    '    // Send request',
    '    const options = { ',
    '      method: method,',
    '      headers: {"Content-Type": "application/json"}',
    '    };',
    '    ',
    '    // Add body for non-GET requests',
    '    if (method !== "GET" && method !== "HEAD") {',
    '      options.body = payload;',
    '    }',
    '    ',
    '    // Store request details for history',
    '    const requestData = {',
    '      timestamp: new Date().toISOString(),',
    '      method,',
    '      endpoint,',
    '      payload',
    '    };',
    '    ',
    '    // Make request',
    '    fetch(url, options)',
    '      .then(response => response.text())',
    '      .then(text => {',
    '        // Format response',
    '        try {',
    '          const json = JSON.parse(text);',
    '          document.getElementById("response").textContent = JSON.stringify(json, null, 2);',
    '          requestData.response = json;',
    '        } catch (e) {',
    '          document.getElementById("response").textContent = text;',
    '          requestData.response = text;',
    '        }',
    '        ',
    '        // Add to history',
    '        addToHistory(requestData);',
    '      })',
    '      .catch(error => {',
    '        document.getElementById("response").textContent = "Error: " + error.message;',
    '        requestData.error = error.message;',
    '        addToHistory(requestData);',
    '      });',
    '  }',
    '  ',
    '  function addToHistory(requestData) {',
    '    requestHistory.unshift(requestData);',
    '    if (requestHistory.length > 10) {',
    '      requestHistory.pop();',
    '    }',
    '    localStorage.setItem("requestHistory", JSON.stringify(requestHistory));',
    '    updateHistoryUI();',
    '  }',
    '  ',
    '  function updateHistoryUI() {',
    '    const historyList = document.getElementById("history-list");',
    '    if (requestHistory.length === 0) {',
    '      historyList.innerHTML = "<p>No requests yet. Send a request to add it to history.</p>";',
    '      return;',
    '    }',
    '    ',
    '    historyList.innerHTML = "";',
    '    requestHistory.forEach((item, index) => {',
    '      const historyItem = document.createElement("div");',
    '      historyItem.className = "history-item";',
    '      historyItem.onclick = () => loadHistoryItem(index);',
    '      ',
    '      const time = new Date(item.timestamp).toLocaleTimeString();',
    '      historyItem.innerHTML = `',
    '        <div class="flex-row">',
    '          <strong>${item.method}</strong>',
    '          <span class="flex-grow">${item.endpoint}</span>',
    '          <span class="status-badge ${item.error ? "status-error" : "status-success"}">',
    '            ${item.error ? "Error" : "Success"}',
    '          </span>',
    '        </div>',
    '        <div><small>${time}</small></div>',
    '      `;',
    '      historyItem.setAttribute("aria-label", `${item.method} request to ${item.endpoint} at ${time}. ${item.error ? "Error" : "Success"}`);',
    '      historyList.appendChild(historyItem);',
    '    });',
    '  }',
    '  ',
    '  function loadHistoryItem(index) {',
    '    const item = requestHistory[index];',
    '    document.getElementById("method").value = item.method;',
    '    document.getElementById("endpoint").value = item.endpoint;',
    '    document.getElementById("payload").value = item.payload;',
    '    ',
    '    // Switch to request tab',
    '    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));',
    '    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));',
    '    document.querySelector(\'[data-tab="request-tab"]\').classList.add("active");',
    '    document.getElementById("request-tab").classList.add("active");',
    '  }',
    '  ',
    '  function pollLogs() {',
    '    fetch("/__logs")',
    '      .then(response => response.json())',
    '      .then(data => {',
    '        if (data && data.logs) {',
    '          const logsEl = document.getElementById("logs");',
    '          logsEl.textContent = data.logs.join("\\n");',
    '          ',
    '          // Auto-scroll to bottom if already at bottom',
    '          if (logsEl.scrollTop + logsEl.clientHeight >= logsEl.scrollHeight - 50) {',
    '            logsEl.scrollTop = logsEl.scrollHeight;',
    '          }',
    '        }',
    '      })',
    '      .catch(error => console.error("Error fetching logs:", error));',
    '  }',
    '  ',
    '  function checkForRebuild() {',
    '    fetch("/__status")',
    '      .then(response => response.json())',
    '      .then(data => {',
    '        if (data && data.rebuilding) {',
    '          document.getElementById("rebuild-notification").style.display = "block";',
    '        }',
    '      })',
    '      .catch(error => console.error("Error checking rebuild status:", error));',
    '  }',
    '  ',
    '  function clearLogs() {',
    '    fetch("/__logs/clear", { method: "POST" })',
    '      .then(() => {',
    '        document.getElementById("logs").textContent = "Logs cleared";',
    '      })',
    '      .catch(error => console.error("Error clearing logs:", error));',
    '  }',
    '  ',
    '  function updateEnvUI(envData) {',
    '    const envContainer = document.getElementById("env-variables");',
    '    envContainer.innerHTML = "";',
    '    ',
    '    // Create inputs for each env var',
    '    Object.entries(envData).forEach(([key, value]) => {',
    '      addEnvRow(key, value);',
    '    });',
    '    ',
    '    // Add an empty row if no variables',
    '    if (Object.keys(envData).length === 0) {',
    '      addEnvRow("", "");',
    '    }',
    '  }',
    '  ',
    '  function addEnvRow(key = "", value = "") {',
    '    const envContainer = document.getElementById("env-variables");',
    '    const row = document.createElement("div");',
    '    row.className = "env-row";',
    '    ',
    '    const keyInput = document.createElement("input");',
    '    keyInput.type = "text";',
    '    keyInput.placeholder = "Variable Name";',
    '    keyInput.value = key;',
    '    keyInput.className = "env-key";',
    '    keyInput.setAttribute("aria-label", key ? `Variable name: ${key}` : "Variable name");',
    '    ',
    '    const valueInput = document.createElement("input");',
    '    valueInput.type = "text";',
    '    valueInput.placeholder = "Value";',
    '    valueInput.value = value;',
    '    valueInput.className = "env-value";',
    '    valueInput.setAttribute("aria-label", key ? `Value for ${key}` : "Variable value");',
    '    ',
    '    const removeBtn = document.createElement("button");',
    '    removeBtn.textContent = "Remove";',
    '    removeBtn.className = "btn btn-sm btn-danger";',
    '    removeBtn.setAttribute("aria-label", `Remove environment variable ${key || "new"}`);',
    '    removeBtn.onclick = function() {',
    '      envContainer.removeChild(row);',
    '    };',
    '    ',
    '    row.appendChild(keyInput);',
    '    row.appendChild(valueInput);',
    '    row.appendChild(removeBtn);',
    '    envContainer.appendChild(row);',
    '  }',
    '  ',
    '  function saveEnvironment() {',
    '    const rows = document.querySelectorAll(".env-row");',
    '    const env = {};',
    '    ',
    '    rows.forEach(row => {',
    '      const key = row.querySelector(".env-key").value.trim();',
    '      const value = row.querySelector(".env-value").value;',
    '      ',
    '      if (key) {',
    '        env[key] = value;',
    '      }',
    '    });',
    '    ',
    '    // Save to server',
    '    fetch("/__env", {',
    '      method: "POST",',
    '      headers: { "Content-Type": "application/json" },',
    '      body: JSON.stringify(env)',
    '    })',
    '      .then(response => response.json())',
    '      .then(data => {',
    '        if (data.success) {',
    '          alert("Environment variables updated and function is rebuilding!");',
    '        } else {',
    '          alert("Error updating environment variables: " + data.error);',
    '        }',
    '      })',
    '      .catch(error => {',
    '        alert("Error saving environment: " + error.message);',
    '      });',
    '  }',
    '</script>',
    '</body>',
    '</html>',
  ];
  
  return lines.join('\n');
}

/**
 * Run a function locally in development mode
 * 
 * @param {Object} options - Command options
 * @param {string} options.path - Path to function file
 * @param {number} options.port - Port to run server on
 * @param {boolean} options.watch - Whether to watch for file changes
 * @param {Object} options.env - Environment variables to pass to function
 * @param {string} options.profile - Profile to use for configuration
 * @returns {Promise<Object>} - Server information
 */
export async function dev(options = {}) {
  try {
    // Validate path
    if (!options.path) {
      throw new Error('Function path is required');
    }
    
    const functionPath = path.resolve(options.path);
    if (!fs.existsSync(functionPath)) {
      throw new Error(`Function file not found: ${functionPath}`);
    }
    
    // Set default port
    const port = options.port || 8787;
    
    // Store console logs to display in the UI
    const logs = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;
    
    // Track rebuilding state
    let isRebuilding = false;
    let buildCompletedAt = null;
    
    // Wrap console methods to capture logs
    function wrapConsole() {
      console.log = (...args) => {
        originalConsoleLog(...args);
        logs.push(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        if (logs.length > 1000) logs.shift(); // Limit log size
      };
      
      console.error = (...args) => {
        originalConsoleError(...args);
        logs.push(`[ERROR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        if (logs.length > 1000) logs.shift();
      };
      
      console.warn = (...args) => {
        originalConsoleWarn(...args);
        logs.push(`[WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        if (logs.length > 1000) logs.shift();
      };
      
      console.info = (...args) => {
        originalConsoleInfo(...args);
        logs.push(`[INFO] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
        if (logs.length > 1000) logs.shift();
      };
    }
    
    // Restore original console methods
    function restoreConsole() {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
    }
    
    // Function to build and update the function code
    async function buildFunction() {
      isRebuilding = true;
      
      showInfo(`Building function from ${path.basename(functionPath)}...`);
      
      // Build the function using esbuild
      const outputPath = path.resolve(process.cwd(), 'function-out.js');
      
      // Use npm script to run esbuild (more reliable than direct binary access)
      const buildArgs = [
        'run',
        'build',
        '--',
        options.path
      ];
      
      return new Promise((resolve, reject) => {
        // Start build process
        const buildProcess = spawn('npm', buildArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        
        const buildOutput = [];
        
        // Handle build output
        buildProcess.stdout.on('data', (data) => {
          const output = data.toString();
          console.log(`[esbuild] ${output}`);
          buildOutput.push(`[esbuild] ${output}`);
        });
        
        buildProcess.stderr.on('data', (data) => {
          const output = data.toString();
          console.error(`[esbuild] ${output}`);
          buildOutput.push(`[esbuild error] ${output}`);
        });
        
        buildProcess.on('close', (code) => {
          isRebuilding = false;
          buildCompletedAt = Date.now();
          
          if (code === 0) {
            console.log(`Build completed successfully`);
            resolve(outputPath);
          } else {
            const error = new Error(`Build failed with exit code ${code}`);
            console.error(error.message);
            reject(error);
          }
        });
        
        buildProcess.on('error', (error) => {
          isRebuilding = false;
          console.error(`Build error: ${error.message}`);
          reject(error);
        });
      });
    }
    
    // Wrap console methods
    wrapConsole();
    
    // Build the function initially
    const outputPath = await buildFunction();
    
    if (!fs.existsSync(outputPath)) {
      restoreConsole();
      throw new Error(`Build failed: Function output file not created`);
    }
    
    // Load API config for environment variables
    const apiConfig = await getApiConfig(options.profile);
    
    // Create environment variables
    const env = {
      ...apiConfig,
      ...(options.env || {}),
    };
    
    // Create mock invoker data for testing
    const mockInvoker = {
      type: 'development',
      id: 'local-dev-server',
      timestamp: new Date().toISOString()
    };
    
    showInfo(`Starting local development server on port ${port}...`);
    
    // Create service worker script that doesn't use import
    let functionCode = await fs.promises.readFile(outputPath, 'utf8');
    
    // Cache the HTML to avoid recreating it for every request
    const testPageHtml = createTestPageHtml(port, env);
    
    // Prepare the dark mode script - first check if it exists in the function directory
    let darkModeScript = '';
    const darkModeFilePath = path.resolve(path.dirname(functionPath), 'improved-dark-mode.js');
    if (fs.existsSync(darkModeFilePath)) {
      darkModeScript = await fs.promises.readFile(darkModeFilePath, 'utf8');
      showInfo(`Using custom dark mode script from: ${darkModeFilePath}`);
    } else {
      // Create a default dark mode script
      darkModeScript = `
        // Default improved dark mode implementation
        document.addEventListener('DOMContentLoaded', () => {
          console.log('Improved dark mode module loaded');
          
          // Enhanced theme detection and persistence
          const themeToggle = document.getElementById('theme-toggle');
          const prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
          
          // Function to detect and apply the best theme
          function detectTheme() {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
              return savedTheme;
            }
            return prefersDarkQuery.matches ? 'dark' : 'light';
          }
          
          // Apply theme to all necessary elements
          function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            
            // Apply to monaco editor if loaded
            if (window.monaco && window.monaco.editor) {
              monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
            }
            
            // Emit custom event for other components
            document.dispatchEvent(new CustomEvent('themeChange', { detail: { theme } }));
          }
          
          // Initialize with correct theme
          applyTheme(detectTheme());
          
          // Listen for system preference changes
          prefersDarkQuery.addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (!localStorage.getItem('theme')) {
              applyTheme(e.matches ? 'dark' : 'light');
            }
          });
          
          // Setup theme toggle button with enhanced feedback
          if (themeToggle) {
            themeToggle.addEventListener('click', () => {
              const currentTheme = document.documentElement.getAttribute('data-theme');
              const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
              applyTheme(newTheme);
              
              // Visual feedback for theme change
              themeToggle.classList.add('theme-changed');
              setTimeout(() => themeToggle.classList.remove('theme-changed'), 500);
            });
          }
        });
      `;
      showInfo('Using default dark mode implementation');
    }
    
    // Create service worker script with test HTML directly inside 
    const createWorkerScript = (functionCode) => `
// Service Worker entry point
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

// Save log references
globalThis._logs = [];
globalThis._env = ${JSON.stringify(env)};
globalThis._rebuilding = false;
globalThis.self = globalThis; // Provide window/self for compatibility
globalThis.window = globalThis; // Add window global for browser APIs
globalThis._version = "${Date.now()}";
globalThis._darkModeScript = ${JSON.stringify(darkModeScript)};

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Override console methods to capture logs
console.log = (...args) => {
  originalConsoleLog(...args);
  globalThis._logs.push('[LOG] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
  if (globalThis._logs.length > 1000) globalThis._logs.shift();
};

console.error = (...args) => {
  originalConsoleError(...args);
  globalThis._logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
  if (globalThis._logs.length > 1000) globalThis._logs.shift();
};

console.warn = (...args) => {
  originalConsoleWarn(...args);
  globalThis._logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
  if (globalThis._logs.length > 1000) globalThis._logs.shift();
};

console.info = (...args) => {
  originalConsoleInfo(...args);
  globalThis._logs.push('[INFO] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
  if (globalThis._logs.length > 1000) globalThis._logs.shift();
};

// Helper functions
function sanitizeJson(str) {
  if (!str) return "{}";
  try {
    // Test if it's valid JSON
    JSON.parse(str);
    return str;
  } catch (e) {
    console.warn("Invalid JSON, sanitizing:", e.message);
    return "{}";
  }
}

// Special route handler
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Special routes for dev server
  
  // Endpoint for logs
  if (url.pathname === '/__logs') {
    return new Response(JSON.stringify({ logs: globalThis._logs }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Endpoint to clear logs
  if (url.pathname === '/__logs/clear' && request.method === 'POST') {
    globalThis._logs = [];
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Endpoint for rebuild status
  if (url.pathname === '/__status') {
    return new Response(JSON.stringify({ 
      rebuilding: globalThis._rebuilding || false,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Endpoint for environment variables
  if (url.pathname === '/__env') {
    if (request.method === 'GET') {
      return new Response(JSON.stringify(globalThis._env || {}), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (request.method === 'POST') {
      try {
        const data = await request.json();
        // We're just forwarding the request to Node.js server
        // The actual environment will be updated there
        return new Response(JSON.stringify({ 
          success: true, 
          env: data,
          message: "Environment variables received. Function rebuilding."
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
  
  // UI for root path
  if (request.method === 'GET' && url.pathname === '/') {
    // Define test page HTML statically
    const html = ${JSON.stringify(testPageHtml)};
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  // Serve the improved dark mode implementation
  if (request.method === 'GET' && url.pathname === '/improved-dark-mode.js') {
    // Return a cached version of the dark mode implementation
    // This is populated by the host server when it starts up
    if (globalThis._darkModeScript) {
      return new Response(globalThis._darkModeScript, {
        headers: { 'Content-Type': 'application/javascript' }
      });
    } else {
      // Return a simple implementation if not initialized yet
      return new Response("console.log('Dark mode script not yet loaded');", {
        headers: { 'Content-Type': 'application/javascript' }
      });
    }
  }
  
  try {
    // Log incoming request
    console.log(\`\${request.method} \${url.pathname}\`);
    
    // Create mock invoker
    const mockInvoker = {
      type: 'development',
      id: 'local-dev-server',
      timestamp: new Date().toISOString()
    };
    
    // Log start time
    console.log('Invoking function...');
    const startTime = Date.now();
    
    // Handle request differently based on method
    let gliaResponse;
    
    if (request.method === 'GET' || request.method === 'HEAD') {
      // For GET/HEAD requests, we can't add a body, so create a POST clone
      const postClone = new Request(request.url, {
        method: 'POST', 
        headers: request.headers,
        body: JSON.stringify({
          invoker: mockInvoker,
          payload: "{}"
        })
      });
      
      // Call onInvoke with the POST clone
      gliaResponse = await onInvoke(postClone, globalThis);
    } else {
      // For other methods, process normally
      let requestBody = "{}";
      try {
        const bodyText = await request.text();
        if (bodyText) {
          // Test parsing but use original text
          JSON.parse(bodyText);
          requestBody = bodyText;
        }
      } catch (e) {
        console.warn('Error parsing request body:', e.message);
      }
      
      // Create Glia-compatible request
      const gliaRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify({
          invoker: mockInvoker,
          payload: requestBody
        })
      });
      
      // Call the function with our request
      gliaResponse = await onInvoke(gliaRequest, globalThis);
    }
    
    // Function execution is done
    console.log(\`Function executed in \${Date.now() - startTime}ms\`);
    return gliaResponse;
  } catch (error) {
    console.error('Error executing function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error',
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Include the bundled function code
${functionCode}
`;

    // Store logs in global scope
    global._logs = logs;
    
    // Generate the initial worker script
    let workerScript = createWorkerScript(functionCode);
    let mf = null;
    
    // Function to initialize or reinitialize Miniflare
    async function initializeMiniflare(script) {
      // If Miniflare instance exists, dispose of it
      if (mf) {
        await mf.dispose();
      }
      
      // Create a new Miniflare instance
      mf = new Miniflare({
        modules: true,
        script,
        bindings: env
      });
      
      // Set rebuilding flag to false in the worker
      try {
        // In Miniflare v4, getGlobalScope is no longer available
        // Instead, we'll modify the worker script to handle this via fetch
        globalThis._rebuilding = false;
      } catch (error) {
        console.error('Failed to set rebuilding flag:', error);
      }
      
      return mf;
    }
    
    // Initialize Miniflare with the worker script
    mf = await initializeMiniflare(workerScript);
    
    // Function to update the worker code
    async function updateWorker() {
      try {
        // Set rebuilding flag in the worker
        if (mf) {
          try {
            // In Miniflare v4, use global variable directly
            globalThis._rebuilding = true;
          } catch (error) {
            console.error('Failed to set rebuilding flag:', error);
          }
        }
        
        // Get the latest function code
        const newFunctionCode = await fs.promises.readFile(outputPath, 'utf8');
        
        // Check if the dark mode script has changed
        const darkModeFilePath = path.resolve(path.dirname(functionPath), 'improved-dark-mode.js');
        if (fs.existsSync(darkModeFilePath)) {
          const newDarkModeScript = await fs.promises.readFile(darkModeFilePath, 'utf8');
          if (newDarkModeScript !== darkModeScript) {
            darkModeScript = newDarkModeScript;
            showInfo('Dark mode script updated');
          }
        }
        
        // Generate a new worker script
        workerScript = createWorkerScript(newFunctionCode);
        
        // Reinitialize Miniflare with the new worker script
        await initializeMiniflare(workerScript);
        
        showSuccess('Worker script updated successfully');
      } catch (error) {
        showError(`Failed to update worker: ${error.message}`);
      }
    }
    
    // Set up file watcher if enabled
    if (options.watch) {
      showInfo(`Watching ${path.basename(functionPath)} for changes...`);
      
      // Watch the function file
      watchFile(functionPath, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          showInfo(`Function file changed. Rebuilding...`);
          try {
            isRebuilding = true;
            await buildFunction();
            await updateWorker();
            showSuccess('Function rebuilt and reloaded');
          } catch (error) {
            showError(`Failed to rebuild function: ${error.message}`);
          }
        }
      });
      
      // Watch dark mode script if it exists
      const darkModeFilePath = path.resolve(path.dirname(functionPath), 'improved-dark-mode.js');
      if (fs.existsSync(darkModeFilePath)) {
        showInfo(`Watching ${path.basename(darkModeFilePath)} for changes...`);
        watchFile(darkModeFilePath, { interval: 1000 }, async (curr, prev) => {
          if (curr.mtime > prev.mtime) {
            showInfo(`Dark mode script changed. Updating...`);
            try {
              darkModeScript = await fs.promises.readFile(darkModeFilePath, 'utf8');
              await updateWorker();
              showSuccess('Dark mode script updated');
            } catch (error) {
              showError(`Failed to update dark mode script: ${error.message}`);
            }
          }
        });
      }
    }
    
    // Create HTTP server to handle requests
    const server = http.createServer(async (req, res) => {
      try {
        // Convert Node.js request to Fetch Request
        const url = new URL(req.url, `http://localhost:${port}`);
        
        // Serve the improved dark mode implementation file
        if (url.pathname === '/improved-dark-mode.js' && req.method === 'GET') {
          // Serve the same dark mode script that was loaded or created during server startup
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript');
          res.end(darkModeScript);
          return;
        }
        
        // Handle environment updates
        if (url.pathname === '/__env' && req.method === 'POST') {
          // Read request body
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const body = Buffer.concat(chunks).toString();
          
          try {
            // Parse environment variables
            const newEnv = JSON.parse(body);
            
            // Update environment
            Object.assign(env, newEnv);
            
            // Rebuild function with new environment
            showInfo('Updating environment variables and rebuilding...');
            await buildFunction();
            await updateWorker();
            
            // Send success response
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              success: true, 
              message: 'Environment variables updated' 
            }));
            return;
          } catch (error) {
            // Send error response
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              success: false, 
              error: error.message || 'Failed to update environment variables' 
            }));
            return;
          }
        }
        
        // Handle logs/clear endpoint directly
        if (url.pathname === '/__logs/clear' && req.method === 'POST') {
          logs.length = 0; // Clear logs array
          global._logs = logs;
          
          // Update logs in worker
          if (mf) {
            try {
              // Dispatch a request to the worker to clear logs
              await mf.dispatchFetch('http://localhost/__logs/clear', {
                method: 'POST'
              });
            } catch (error) {
              console.error('Failed to clear logs in worker:', error);
            }
          }
          
          // Send success response
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }
        
        // Handle status endpoint directly
        if (url.pathname === '/__status') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
            rebuilding: isRebuilding,
            buildCompletedAt,
            timestamp: Date.now()
          }));
          return;
        }
        
        // Collect request body if present for other endpoints
        let body = null;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks).toString();
        }
        
        // Create a Fetch API Request from the Node.js request
        const fetchRequest = new Request(url, {
          method: req.method,
          headers: req.headers,
          body: body || undefined
        });
        
        // Handle request with Miniflare
        const fetchResponse = await mf.dispatchFetch(url.toString(), fetchRequest);
        
        // Convert Fetch Response to Node.js response
        res.statusCode = fetchResponse.status;
        
        // Set response headers
        for (const [key, value] of fetchResponse.headers.entries()) {
          res.setHeader(key, value);
        }
        
        // Send response body
        const responseBody = await fetchResponse.arrayBuffer();
        res.end(Buffer.from(responseBody));
      } catch (error) {
        // Handle errors
        console.error('Server error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message || 'Internal Server Error' }));
      }
    });
    
    try {
      // Start the HTTP server
      await new Promise((resolve, reject) => {
        server.listen(port, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      showSuccess(`\n🚀 Development server running at http://localhost:${port}`);
      showInfo(`Open http://localhost:${port} in your browser to test your function.`);
      
      if (options.watch) {
        showInfo(`Watching for changes to ${path.basename(functionPath)}`);
      } else {
        showInfo(`Hot reloading is disabled. Use --watch flag to enable.`);
      }
    } catch (err) {
      showError(`Failed to start server: ${err.message}`);
      throw err;
    }
    
    // Add event listeners to handle process exit
    process.on('SIGINT', () => {
      showInfo('Shutting down development server...');
      server.close();
      if (mf) mf.dispose(); // Clean up miniflare
      restoreConsole();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      showInfo('Shutting down development server...');
      server.close();
      if (mf) mf.dispose(); // Clean up miniflare
      restoreConsole();
      process.exit(0);
    });
    
    return {
      url: `http://localhost:${port}`,
      port,
      functionPath,
      outputPath,
      env: Object.keys(env).length
    };
  } catch (error) {
    console.error(`Failed to start development server:`, error);
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
function main() {
  const command = new BaseCommand('dev', 'Run function locally in development mode')
    .option('--path <path>', 'Path to function file')
    .option('--port <port>', 'Port to run server on', '8787')
    .option('--watch', 'Watch for file changes and rebuild', false)
    .option('--env <json>', 'Environment variables as JSON string', '{}')
    .option('--profile <n>', 'Profile to use for environment variables')
    .action(async (options) => {
      try {
        // Parse environment variables
        let env = {};
        if (options.env && options.env !== '{}') {
          try {
            env = JSON.parse(options.env);
          } catch (error) {
            showError(`Invalid environment variables JSON: ${error.message}`);
            process.exit(1);
          }
        }
        
        // Start development server
        await dev({
          path: options.path,
          port: parseInt(options.port, 10) || 8787,
          watch: options.watch,
          env,
          profile: options.profile
        });
        
        // Keep the process running
        process.stdin.resume();
      } catch (error) {
        showError(`Development server error: ${error.message}`);
        process.exit(1);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1])) {
  main();
}

export default dev;