/**
 * replace_icons.js — Batch migration Ionicons → Lucide
 * Run with: node replace_icons.js
 */
const fs = require('fs');
const path = require('path');

// Map of Ionicons name → Lucide import name
const ICON_MAP = {
    // Navigation
    'arrow-back': 'ArrowLeft', 'arrow-back-outline': 'ArrowLeft',
    'arrow-forward': 'ArrowRight', 'arrow-forward-outline': 'ArrowRight',
    'chevron-forward': 'ChevronRight', 'chevron-forward-outline': 'ChevronRight',
    'chevron-back': 'ChevronLeft', 'chevron-back-outline': 'ChevronLeft',
    'chevron-down': 'ChevronDown', 'chevron-down-outline': 'ChevronDown',
    'chevron-up': 'ChevronUp', 'chevron-up-outline': 'ChevronUp',
    'close': 'X', 'close-outline': 'X',
    'menu': 'Menu', 'menu-outline': 'Menu',
    'open': 'ExternalLink', 'open-outline': 'ExternalLink',

    // Documents & Services
    'document-text': 'FileText', 'document-text-outline': 'FileText',
    'document-attach': 'Paperclip', 'document-attach-outline': 'Paperclip',
    'documents': 'Files', 'documents-outline': 'Files',
    'folder': 'Folder', 'folder-outline': 'Folder',
    'folder-open': 'FolderOpen', 'folder-open-outline': 'FolderOpen',
    'business': 'Building2', 'business-outline': 'Building2',
    'compass': 'Compass', 'compass-outline': 'Compass',
    'construct': 'Landmark', 'construct-outline': 'Landmark',
    'trending-up': 'TrendingUp', 'trending-up-outline': 'TrendingUp',
    'briefcase': 'Briefcase', 'briefcase-outline': 'Briefcase',
    'ribbon': 'Award', 'ribbon-outline': 'Award',

    // User & Profile
    'person': 'User', 'person-outline': 'User',
    'person-circle': 'UserCircle', 'person-circle-outline': 'UserCircle',
    'people': 'Users', 'people-outline': 'Users',
    'settings': 'Settings', 'settings-outline': 'Settings',
    'shield-checkmark': 'ShieldCheck', 'shield-checkmark-outline': 'ShieldCheck',
    'shield': 'Shield', 'shield-outline': 'Shield',
    'lock-closed': 'Lock', 'lock-closed-outline': 'Lock',
    'log-out': 'LogOut', 'log-out-outline': 'LogOut',
    'eye': 'Eye', 'eye-outline': 'Eye',
    'eye-off': 'EyeOff', 'eye-off-outline': 'EyeOff',
    'key': 'Key', 'key-outline': 'Key',
    'finger-print': 'Fingerprint', 'finger-print-outline': 'Fingerprint',

    // Communication
    'notifications': 'Bell', 'notifications-outline': 'Bell',
    'mail': 'Mail', 'mail-outline': 'Mail',
    'chatbubble': 'MessageSquare', 'chatbubble-outline': 'MessageSquare',
    'chatbubbles': 'MessageCircle', 'chatbubbles-outline': 'MessageCircle',
    'send': 'Send', 'send-outline': 'Send',
    'call': 'Phone', 'call-outline': 'Phone',

    // Actions
    'search': 'Search', 'search-outline': 'Search',
    'add': 'Plus', 'add-outline': 'Plus',
    'add-circle': 'PlusCircle', 'add-circle-outline': 'PlusCircle',
    'remove': 'Minus', 'remove-outline': 'Minus',
    'create': 'Pencil', 'create-outline': 'Pencil',
    'pencil': 'Pencil', 'pencil-outline': 'Pencil',
    'trash': 'Trash2', 'trash-outline': 'Trash2',
    'share-social': 'Share2', 'share-social-outline': 'Share2',
    'copy': 'Copy', 'copy-outline': 'Copy',
    'download': 'Download', 'download-outline': 'Download',
    'cloud-upload': 'Upload', 'cloud-upload-outline': 'Upload',
    'filter': 'Filter', 'filter-outline': 'Filter',
    'camera': 'Camera', 'camera-outline': 'Camera',
    'image': 'ImageIcon', 'image-outline': 'ImageIcon',
    'attach': 'Paperclip', 'attach-outline': 'Paperclip',
    'refresh': 'RefreshCw', 'refresh-outline': 'RefreshCw',
    'swap-horizontal': 'ArrowLeftRight', 'swap-horizontal-outline': 'ArrowLeftRight',
    'qr-code': 'QrCode', 'qr-code-outline': 'QrCode',

    // Status & Feedback
    'checkmark-circle': 'CheckCircle', 'checkmark-circle-outline': 'CheckCircle',
    'checkmark': 'Check', 'checkmark-outline': 'Check',
    'close-circle': 'XCircle', 'close-circle-outline': 'XCircle',
    'alert-circle': 'AlertCircle', 'alert-circle-outline': 'AlertCircle',
    'warning': 'AlertTriangle', 'warning-outline': 'AlertTriangle',
    'information-circle': 'Info', 'information-circle-outline': 'Info',
    'help-circle': 'HelpCircle', 'help-circle-outline': 'HelpCircle',
    'star': 'Star', 'star-outline': 'Star',
    'heart': 'Heart', 'heart-outline': 'Heart',

    // Datetime & Location
    'calendar': 'Calendar', 'calendar-outline': 'Calendar',
    'time': 'Clock', 'time-outline': 'Clock',
    'location': 'MapPin', 'location-outline': 'MapPin',
    'globe': 'Globe', 'globe-outline': 'Globe',
    'map': 'Map', 'map-outline': 'Map',

    // Money & Commerce
    'card': 'CreditCard', 'card-outline': 'CreditCard',
    'cash': 'Banknote', 'cash-outline': 'Banknote',
    'wallet': 'Wallet', 'wallet-outline': 'Wallet',
    'bag-handle': 'ShoppingBag', 'bag-handle-outline': 'ShoppingBag',
    'cart': 'ShoppingCart', 'cart-outline': 'ShoppingCart',
    'receipt': 'Receipt', 'receipt-outline': 'Receipt',
    'pricetag': 'Tag', 'pricetag-outline': 'Tag',

    // Misc
    'grid': 'LayoutGrid', 'grid-outline': 'LayoutGrid',
    'list': 'List', 'list-outline': 'List',
    'ellipsis-horizontal': 'MoreHorizontal', 'ellipsis-horizontal-outline': 'MoreHorizontal',
    'ellipsis-vertical': 'MoreVertical', 'ellipsis-vertical-outline': 'MoreVertical',
    'home': 'Home', 'home-outline': 'Home',
    'flag': 'Flag', 'flag-outline': 'Flag',
    'book': 'BookOpen', 'book-outline': 'BookOpen',
    'school': 'GraduationCap', 'school-outline': 'GraduationCap',
    'link': 'Link', 'link-outline': 'Link',
    'code': 'Code', 'code-outline': 'Code',
    'wifi': 'Wifi', 'wifi-outline': 'Wifi',
    'airplane': 'Plane', 'airplane-outline': 'Plane',
    'car': 'Car', 'car-outline': 'Car',
    'medkit': 'Cross', 'medkit-outline': 'Cross',
    'fitness': 'Dumbbell', 'fitness-outline': 'Dumbbell',
    'flash': 'Zap', 'flash-outline': 'Zap',
    'happy': 'Smile', 'happy-outline': 'Smile',
    'sad': 'Frown', 'sad-outline': 'Frown',
    'logo-whatsapp': 'MessageCircle',
    'play': 'Play', 'play-outline': 'Play',
    'pause': 'Pause', 'pause-outline': 'Pause',
    'power': 'Power', 'power-outline': 'Power',
    'newspaper': 'Newspaper', 'newspaper-outline': 'Newspaper',
    'chatbox': 'MessageSquare', 'chatbox-outline': 'MessageSquare',
    'help': 'HelpCircle', 'help-outline': 'HelpCircle',
};

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
    
    // Skip if no Ionicons import
    if (!content.includes("from '@expo/vector-icons'")) return;
    
    // Find all Ionicons name="..." usages
    const usedIcons = new Set();
    const iconRegex = /Ionicons\s+name="([^"]+)"/g;
    let match;
    while ((match = iconRegex.exec(content)) !== null) {
        const ionName = match[1];
        const lucideName = ICON_MAP[ionName];
        if (lucideName) {
            usedIcons.add(lucideName);
        } else {
            console.warn(`  ⚠️  No mapping for "${ionName}" in ${path.basename(filePath)}`);
            usedIcons.add('HelpCircle'); // fallback
        }
    }
    
    if (usedIcons.size === 0) {
        console.log(`  ⏭️  ${path.basename(filePath)} — no Ionicons name= usage found (might use dynamic names)`);
        return;
    }
    
    // Replace import
    const lucideImports = Array.from(usedIcons).sort().join(', ');
    content = content.replace(
        /import\s*\{\s*Ionicons\s*\}\s*from\s*'@expo\/vector-icons'/,
        `import { ${lucideImports} } from 'lucide-react-native'`
    );
    
    // Replace each <Ionicons name="xxx" size={N} color={...} (optional style={...}) />
    // Pattern: <Ionicons name="icon-name" size={N} color={expr} optional-style />
    for (const [ionName, lucideName] of Object.entries(ICON_MAP)) {
        // Escape special regex chars in icon name
        const escaped = ionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Match: <Ionicons name="icon-name" size={N} color={expr} />
        // or <Ionicons name="icon-name" size={N} color="string" />
        // Also handle optional style prop
        const pattern = new RegExp(
            `<Ionicons\\s+name="${escaped}"\\s+size=\\{(\\d+)\\}\\s+color=\\{([^}]+)\\}(\\s+style=\\{[^}]+\\})?\\s*/>`,
            'g'
        );
        content = content.replace(pattern, (m, size, color, style) => {
            const styleStr = style ? style.trim() : '';
            return `<${lucideName} size={${size}} color={${color}} strokeWidth={1.75} ${styleStr}/>`;
        });
        
        // Handle color="string" variant
        const pattern2 = new RegExp(
            `<Ionicons\\s+name="${escaped}"\\s+size=\\{(\\d+)\\}\\s+color="([^"]+)"(\\s+style=\\{[^}]+\\})?\\s*/>`,
            'g'
        );
        content = content.replace(pattern2, (m, size, color, style) => {
            const styleStr = style ? style.trim() : '';
            return `<${lucideName} size={${size}} color="${color}" strokeWidth={1.75} ${styleStr}/>`;
        });

        // Handle: <Ionicons\n  name="xxx"\n  size={N}\n  color={...}\n  style={...}\n/>  (multiline)
        const pattern3 = new RegExp(
            `<Ionicons\\s+name="${escaped}"\\s+size=\\{(\\d+)\\}\\s+color=\\{([^}]+)\\}`,
            'g'
        );
        content = content.replace(pattern3, (m, size, color) => {
            return `<${lucideName} size={${size}} color={${color}} strokeWidth={1.75}`;
        });
    }
    
    // Clean any remaining "Ionicons" references in the file (for edge cases like Ionicons.glyphMap)
    // Don't auto-replace these — they need manual attention
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅  ${path.basename(filePath)} — migrated (${usedIcons.size} icons: ${Array.from(usedIcons).join(', ')})`);
}

console.log('\n🔄 Migrating Ionicons → Lucide React Native...\n');

const srcDir = path.join(__dirname, 'src');
walkDir(srcDir, processFile);

console.log('\n✅ Done! Run "npx tsc --noEmit" to check for errors.\n');
