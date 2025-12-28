/**
 * clean.ts - Removes unnecessary escape characters from markdown files exported from Google Docs
 * 
 * Google Docs escapes way too much when exporting to markdown. This script fixes:
 * - \! → ! (except before [ which would trigger image syntax)
 * - \- → - (except at line start where it would create a list item)
 * 
 * Usage: npx ts-node scripts/clean.ts <filename.md>
 * Output: Overwrites the file, saves original as .md.old
 */

import * as fs from 'fs';
import * as path from 'path';

function cleanMarkdown(content: string): string {
    const lines = content.split('\n');
    const cleanedLines = lines.map(line => {
        let result = '';
        let i = 0;
        
        while (i < line.length) {
            if (line[i] === '\\' && i + 1 < line.length) {
                const nextChar = line[i + 1];
                // Handle \!
                if (nextChar === '!') {
                    const charAfterBang = line[i + 2];
                    if (charAfterBang === '[') {
                        result += '\\!';
                    } else {
                        result += '!';
                    }
                    i += 2;
                    continue;
                }
                // Handle \-
                if (nextChar === '-') {
                    const trimmedSoFar = result.trim();
                    if (trimmedSoFar === '') {
                        result += '\\-';
                    } else {
                        result += '-';
                    }
                    i += 2;
                    continue;
                }
                // Handle unnecessary escaped period (\.)
                if (nextChar === '.') {
                    // Only keep escape if at line start and followed by a digit (ordered list), e.g. "1\. Text"
                    const trimmedSoFar = result.trim();
                    const charAfterDot = line[i + 2];
                    if (trimmedSoFar === '' && /\d/.test(line[i - 1] || '')) {
                        // e.g. "1\. Text" at start of line, keep escape
                        result += '\\.';
                    } else {
                        // Otherwise, remove escape
                        result += '.';
                    }
                    i += 2;
                    continue;
                }
                // Other escapes - keep as-is
                result += line[i];
                i++;
            } else {
                result += line[i];
                i++;
            }
        }
        
        return result;
    });
    
    return cleanedLines.join('\n');
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length !== 1) {
        console.error('Usage: npx ts-node scripts/clean.ts <filename.md>');
        process.exit(1);
    }
    
    const inputFile = args[0];
    
    if (!fs.existsSync(inputFile)) {
        console.error(`File not found: ${inputFile}`);
        process.exit(1);
    }
    
    if (!inputFile.endsWith('.md')) {
        console.error('File must be a .md file');
        process.exit(1);
    }
    
    // Read original content
    const originalContent = fs.readFileSync(inputFile, 'utf-8');
    
    // Clean it
    const cleanedContent = cleanMarkdown(originalContent);
    
    // Rename original to .md.old
    const oldFile = inputFile.replace(/\.md$/, '.md.old');
    fs.renameSync(inputFile, oldFile);
    console.log(`Original saved as: ${oldFile}`);
    
    // Write cleaned content
    fs.writeFileSync(inputFile, cleanedContent, 'utf-8');
    console.log(`Cleaned file written: ${inputFile}`);
    
    // Report changes
    const originalEscapedBangs = (originalContent.match(/\\!/g) || []).length;
    const cleanedEscapedBangs = (cleanedContent.match(/\\!/g) || []).length;
    const originalEscapedDashes = (originalContent.match(/\\-/g) || []).length;
    const cleanedEscapedDashes = (cleanedContent.match(/\\-/g) || []).length;
    const originalEscapedPeriods = (originalContent.match(/\\\./g) || []).length;
    const cleanedEscapedPeriods = (cleanedContent.match(/\\\./g) || []).length;
    
    console.log(`Removed ${originalEscapedBangs - cleanedEscapedBangs} unnecessary \\! escapes`);
    console.log(`Removed ${originalEscapedDashes - cleanedEscapedDashes} unnecessary \\- escapes`);
    console.log(`Removed ${originalEscapedPeriods - cleanedEscapedPeriods} unnecessary \\.` + ' escapes');
}

main();
