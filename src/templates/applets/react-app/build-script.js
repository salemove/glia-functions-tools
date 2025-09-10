/**
 * Build Script for {{appletName}}
 * 
 * This script takes the output of the React build and bundles it into a single HTML file
 * that can be deployed as a Glia Applet.
 */

const fs = require('fs');
const path = require('path');

// Paths
const buildDir = path.resolve(__dirname, 'build');
const indexHtmlPath = path.join(buildDir, 'index.html');
const appletOutputPath = path.resolve(__dirname, 'applet.html');

// Function to extract URLs from HTML
function extractUrlsFromHtml(html) {
  const cssRegex = /<link[^>]*href="([^"]*\.css)"[^>]*>/g;
  const jsRegex = /<script[^>]*src="([^"]*\.js)"[^>]*><\/script>/g;
  
  const cssUrls = [];
  const jsUrls = [];
  
  let match;
  while ((match = cssRegex.exec(html)) !== null) {
    cssUrls.push(match[1]);
  }
  
  while ((match = jsRegex.exec(html)) !== null) {
    jsUrls.push(match[1]);
  }
  
  return { cssUrls, jsUrls };
}

// Function to inline CSS
function inlineCSS(html, cssUrls) {
  let result = html;
  
  for (const url of cssUrls) {
    const cssPath = path.join(buildDir, url);
    if (fs.existsSync(cssPath)) {
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      const linkTag = new RegExp(`<link[^>]*href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'g');
      const styleTag = `<style>${cssContent}</style>`;
      result = result.replace(linkTag, styleTag);
    }
  }
  
  return result;
}

// Function to inline JavaScript
function inlineJS(html, jsUrls) {
  let result = html;
  
  for (const url of jsUrls) {
    const jsPath = path.join(buildDir, url);
    if (fs.existsSync(jsPath)) {
      const jsContent = fs.readFileSync(jsPath, 'utf8');
      const scriptTag = new RegExp(`<script[^>]*src="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*><\/script>`, 'g');
      const inlineScriptTag = `<script>${jsContent}</script>`;
      result = result.replace(scriptTag, inlineScriptTag);
    }
  }
  
  return result;
}

// Main function
async function bundleApplet() {
  try {
    console.log('🔍 Reading build files...');
    
    // Read the index.html file
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    
    // Extract URLs
    const { cssUrls, jsUrls } = extractUrlsFromHtml(indexHtml);
    
    console.log(`📦 Found ${cssUrls.length} CSS and ${jsUrls.length} JS files to inline`);
    
    // Inline CSS and JS
    let result = inlineCSS(indexHtml, cssUrls);
    result = inlineJS(result, jsUrls);
    
    // Write the bundled HTML file
    fs.writeFileSync(appletOutputPath, result, 'utf8');
    
    console.log(`✅ Applet successfully bundled to: ${appletOutputPath}`);
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Deploy the function: glia-functions deploy --path ./function.js');
    console.log('   2. Deploy the applet: glia-functions deploy-applet --path ./applet.html');
    
  } catch (error) {
    console.error('❌ Error bundling applet:', error);
    process.exit(1);
  }
}

// Run the script
bundleApplet();