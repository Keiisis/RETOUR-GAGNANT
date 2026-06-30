/**
 * fix_remaining_ionicons.js — Fix remaining Ionicons references
 * Adds Ionicons import back where needed alongside Lucide
 */
const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

function processFile(filePath) {
    if (!filePath.endsWith('.tsx')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if no remaining Ionicons references
    if (!content.includes('Ionicons')) return;
    
    // If the file already has lucide import but still uses Ionicons,
    // add back the Ionicons import as a fallback
    if (content.includes("from 'lucide-react-native'") && !content.includes("from '@expo/vector-icons'")) {
        content = content.replace(
            "from 'lucide-react-native'",
            "from 'lucide-react-native'\nimport { Ionicons } from '@expo/vector-icons'"
        );
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  🔧  ${path.basename(filePath)} — added Ionicons fallback import`);
    }
}

console.log('\n🔧 Fixing remaining Ionicons references...\n');

const srcDir = path.join(__dirname, 'src');
walkDir(srcDir, processFile);

console.log('\n✅ Done!\n');
