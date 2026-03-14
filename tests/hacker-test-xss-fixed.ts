/**
 * HACKER TEST: XSS Fix Verification
 * 
 * Verifica que las vulnerabilidades innerHTML fueron parcheadas.
 * 
 * Busca patrones de innerHTML con contenido dinámico (e.message, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '..', 'src');

const VULNERABLE_PATTERNS = [
    { pattern: /\.innerHTML\s*=\s*`[^`]*\$\{.*\.message/g, desc: 'innerHTML with e.message' },
    { pattern: /\.innerHTML\s*=\s*`[^`]*\$\{.*paymentError/g, desc: 'innerHTML with paymentError' },
    { pattern: /\.innerHTML\s*\+=\s*`[^`]*\$\{.*JSON\.stringify/g, desc: 'innerHTML with JSON.stringify' },
];

const SAFE_FILES = [
    'bet-handler.ts',
    'auth/login-handlers.ts',
    'auth/auth-state.ts',
];

function checkFile(filePath: string): { vuln: boolean; matches: string[] } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches: string[] = [];
    
    for (const { pattern, desc } of VULNERABLE_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(content)) {
            matches.push(desc);
        }
    }
    
    return { vuln: matches.length > 0, matches };
}

async function testXSSFix() {
    console.log('\n=== HACKER TEST: XSS Fix Verification ===\n');
    
    let passed = 0;
    let failed = 0;
    
    for (const relPath of SAFE_FILES) {
        const filePath = path.join(SRC_DIR, relPath);
        
        if (!fs.existsSync(filePath)) {
            console.log(`  ⚠️  ${relPath} - file not found`);
            continue;
        }
        
        const { vuln, matches } = checkFile(filePath);
        
        if (vuln) {
            console.log(`  ❌ ${relPath} - VULNERABLE: ${matches.join(', ')}`);
            failed++;
        } else {
            console.log(`  ✅ ${relPath} - safe`);
            passed++;
        }
    }
    
    // Scan all src files for any remaining innerHTML with dynamic content
    console.log('\n--- Full src/ scan ---');
    let fullScanPass = true;
    
    function scanDir(dir: string) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                scanDir(filePath);
            } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                const { vuln, matches } = checkFile(filePath);
                if (vuln) {
                    const relPath = path.relative(SRC_DIR, filePath);
                    console.log(`  ⚠️  ${relPath} - ${matches.join(', ')}`);
                    fullScanPass = false;
                }
            }
        }
    }
    
    scanDir(SRC_DIR);
    
    if (fullScanPass) {
        console.log('  ✅ No innerHTML with dynamic content found in src/');
        passed++;
    } else {
        failed++;
    }
    
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    
    if (failed > 0) {
        console.log('⚠️  Some files still have innerHTML with dynamic content!');
        console.log('    These are potential XSS vulnerabilities.\n');
    }
}

testXSSFix();
