import fs from 'fs';
import path from 'path';

const contentPath = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\9f1fe5b9-d7e3-44db-a6cb-76af064ad67d\\.system_generated\\steps\\180\\content.md';
const content = fs.readFileSync(contentPath, 'utf8');

// Find <style> and </style>
const styleStart = content.indexOf('<style>');
const styleEnd = content.indexOf('</style>');

if (styleStart === -1 || styleEnd === -1) {
  console.error('Could not find style tag in content.md');
  process.exit(1);
}

let css = content.slice(styleStart + '<style>'.length, styleEnd).trim();

// Replace relative asset paths with properly quoted absolute /assets/ paths
css = css.replace(/url\((['"]?)assets\/([^'")]+)\1\)/g, 'url("/assets/$2")');
css = css.replace(/url\(assets\/([^'")]+)\)/g, 'url("/assets/$1")');

// Prepend Google fonts import for Geist and Onest
const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@600;700;800&family=Onest:wght@400;500;600&display=swap');\n\n`;

const finalCss = fontImport + css;

fs.writeFileSync('app/globals.css', finalCss);
console.log('Successfully wrote app/globals.css, length:', finalCss.length);
