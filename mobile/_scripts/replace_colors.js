const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('c:\\Users\\HP\\Desktop\\RETOUR GAGNANT TEMPLATE\\mobile\\src\\screens', function(filePath) {
    if (!filePath.endsWith('.tsx')) return;
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content
            .replace(/colors\.goldMuted/g, 'colors.primaryMuted')
            .replace(/colors\.goldLight/g, 'colors.primaryLight')
            .replace(/colors\.goldDark/g, 'colors.primaryDark')
            .replace(/colors\.goldSoft/g, 'colors.primarySoft')
            .replace(/colors\.goldShimmer/g, 'colors.primaryMuted')
            .replace(/colors\.gold/g, 'colors.primary')
            .replace(/goldLine/g, 'primaryLine');

        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Modified ' + filePath);
        }
    } catch (e) {
        console.error(e);
    }
});
