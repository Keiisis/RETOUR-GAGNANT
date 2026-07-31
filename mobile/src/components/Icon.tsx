/**
 * ═══════════════════════════════════════════════════════════
 *  Icon Bridge — Nexus Emerald Design System
 *  
 *  Wrapper qui permet d'utiliser les icônes Lucide (identiques au site web)
 *  tout en conservant le fallback Ionicons pour la transition progressive.
 *  
 *  Usage :
 *    import { LucideIcon } from '../components/Icon'
 *    <LucideIcon name="Home" size={24} color={colors.primary} />
 *  
 *  Pour les écrans déjà migrés, importer directement depuis lucide-react-native :
 *    import { Home, FileText, Building2 } from 'lucide-react-native'
 * ═══════════════════════════════════════════════════════════
 */

import React from 'react'
import {
    Home, FileText, Building2, Compass, Landmark, TrendingUp,
    User, Settings, Bell, Search, ChevronRight, ChevronLeft,
    ChevronDown, ChevronUp, ArrowUp, Calendar, Clock, MapPin, Phone,
    Mail, Lock, Eye, EyeOff, Plus, Minus, X, Check, 
    AlertCircle, Info, HelpCircle, Star, Heart, Share2,
    Download, Upload, Camera, Image, Shield, CreditCard,
    LogOut, Menu, Filter, Edit, Trash2, Send, MessageSquare,
    Globe, ArrowLeft, ArrowRight, ExternalLink, Copy,
    CheckCircle, XCircle, AlertTriangle,
    Undo2,
    CornerUpLeft,
    LayoutGrid,
    Layers,
    List,
    SlidersHorizontal,
    RefreshCw,
    Link,
    PencilLine,
    Images,
    Video,
    CheckCheck,
    Activity,
    ShieldCheck,
    Key,
    Fingerprint,
    File,
    Paperclip,
    Folder,
    FolderOpen,
    UploadCloud,
    Receipt,
    ScanLine,
    BookOpen,
    Library,
    MailOpen,
    MessagesSquare,
    MessageCircle,
    Headphones,
    BellOff,
    CircleUser,
    Users,
    ShoppingCart,
    ShoppingBag,
    Store,
    Banknote,
    Wallet,
    Ticket,
    Package,
    Truck,
    Plane,
    Map,
    Languages,
    Flag,
    Briefcase,
    Sparkles,
    Award,
    Lightbulb,
    Hammer,
    GitBranch,
    Network,
    Smartphone,
    CheckCircle2,
    Circle, type LucideProps,
} from 'lucide-react-native'

// ── Mapping Ionicons → Lucide (pour faciliter la migration progressive) ──
const ICON_MAP: Record<string, React.FC<LucideProps>> = {
    // Navigation
    'home': Home,
    'home-outline': Home,
    'arrow-back': ArrowLeft,
    'arrow-back-outline': ArrowLeft,
    'arrow-forward': ArrowRight,
    'arrow-forward-outline': ArrowRight,
    'chevron-forward': ChevronRight,
    'chevron-forward-outline': ChevronRight,
    'chevron-back': ChevronLeft,
    'chevron-back-outline': ChevronLeft,
    'chevron-down': ChevronDown,
    'chevron-down-outline': ChevronDown,
    'chevron-up': ChevronUp,
    'chevron-up-outline': ChevronUp,
    'menu': Menu,
    'menu-outline': Menu,
    'close': X,
    'close-outline': X,

    // Documents & Services
    'document-text': FileText,
    'document-text-outline': FileText,
    'business': Building2,
    'business-outline': Building2,
    'compass': Compass,
    'compass-outline': Compass,
    'construct': Landmark,
    'construct-outline': Landmark,
    'trending-up': TrendingUp,
    'trending-up-outline': TrendingUp,

    // User & Profile
    'person': User,
    'person-outline': User,
    'person-circle': User,
    'person-circle-outline': User,
    'settings': Settings,
    'settings-outline': Settings,
    'shield-checkmark': Shield,
    'shield-checkmark-outline': Shield,
    'lock-closed': Lock,
    'lock-closed-outline': Lock,
    'log-out': LogOut,
    'log-out-outline': LogOut,
    'eye': Eye,
    'eye-outline': Eye,
    'eye-off': EyeOff,
    'eye-off-outline': EyeOff,

    // Communication
    'notifications': Bell,
    'notifications-outline': Bell,
    'mail': Mail,
    'mail-outline': Mail,
    'chatbubble': MessageSquare,
    'chatbubble-outline': MessageSquare,
    'chatbubbles': MessageSquare,
    'chatbubbles-outline': MessageSquare,
    'send': Send,
    'send-outline': Send,
    'call': Phone,
    'call-outline': Phone,

    // Actions
    'search': Search,
    'search-outline': Search,
    'add': Plus,
    'add-outline': Plus,
    'remove': Minus,
    'remove-outline': Minus,
    'create': Edit,
    'create-outline': Edit,
    'trash': Trash2,
    'trash-outline': Trash2,
    'share-social': Share2,
    'share-social-outline': Share2,
    'copy': Copy,
    'copy-outline': Copy,
    'download': Download,
    'download-outline': Download,
    'cloud-upload': Upload,
    'cloud-upload-outline': Upload,
    'filter': Filter,
    'filter-outline': Filter,
    'camera': Camera,
    'camera-outline': Camera,
    'image': Image,
    'image-outline': Image,

    // Status & Feedback
    'checkmark-circle': CheckCircle,
    'checkmark-circle-outline': CheckCircle,
    'checkmark': Check,
    'checkmark-outline': Check,
    'close-circle': XCircle,
    'close-circle-outline': XCircle,
    'alert-circle': AlertCircle,
    'alert-circle-outline': AlertCircle,
    'warning': AlertTriangle,
    'warning-outline': AlertTriangle,
    'information-circle': Info,
    'information-circle-outline': Info,
    'help-circle': HelpCircle,
    'help-circle-outline': HelpCircle,
    'star': Star,
    'star-outline': Star,
    'heart': Heart,
    'heart-outline': Heart,

    // Misc
    'calendar': Calendar,
    'calendar-outline': Calendar,
    'time': Clock,
    'time-outline': Clock,
    'location': MapPin,
    'location-outline': MapPin,
    'globe': Globe,
    'globe-outline': Globe,
    'card': CreditCard,
    'card-outline': CreditCard,
    'open': ExternalLink,
    'open-outline': ExternalLink,

    /* Complement : couvre les noms reellement employes dans l'app.
       Les logos de marque (Facebook, Instagram, YouTube) restent sur
       Ionicons : Lucide les a retires de sa version 1, et un globe
       generique a leur place ferait perdre la reconnaissance immediate. */
    'airplane-outline': Plane,
    'apps-outline': LayoutGrid,
    'arrow-undo-outline': Undo2,
    'arrow-up': ArrowUp,
    'bag-handle': ShoppingBag,
    'bag-handle-outline': ShoppingBag,
    'bag-outline': ShoppingBag,
    'barcode-outline': ScanLine,
    'book-outline': BookOpen,
    'briefcase-outline': Briefcase,
    'bulb-outline': Lightbulb,
    'car-outline': Truck,
    'cart-outline': ShoppingCart,
    'cash-outline': Banknote,
    'chatbubble-ellipses': MessageCircle,
    'chatbubble-ellipses-outline': MessageCircle,
    'checkmark-done': CheckCheck,
    'cube': Package,
    'cube-outline': Package,
    'document-attach': Paperclip,
    'document-outline': File,
    'earth-outline': Globe,
    'finger-print': Fingerprint,
    'flag-outline': Flag,
    'folder-open': FolderOpen,
    'folder-open-outline': FolderOpen,
    'folder-outline': Folder,
    'git-branch': GitBranch,
    'git-network-outline': Network,
    'hammer-outline': Hammer,
    'headset': Headphones,
    'images-outline': Images,
    'key-outline': Key,
    'language-outline': Languages,
    'layers-outline': Layers,
    'library': Library,
    'link-outline': Link,
    'list': List,
    'logo-whatsapp': MessageCircle,
    'mail-unread-outline': MailOpen,
    'male-female-outline': Users,
    'man-outline': User,
    'map': Map,
    'map-outline': Map,
    'notifications-off-outline': BellOff,
    'paper-plane': Send,
    'paper-plane-outline': Send,
    'people': Users,
    'people-outline': Users,
    'phone-portrait-outline': Smartphone,
    'pulse-outline': Activity,
    'receipt': Receipt,
    'receipt-outline': Receipt,
    'refresh-outline': RefreshCw,
    'return-up-back-outline': CornerUpLeft,
    'ribbon': Award,
    'ribbon-outline': Award,
    'search-circle-outline': Search,
    'share-outline': Share2,
    'sparkles': Sparkles,
    'sparkles-outline': Sparkles,
    'storefront': Store,
    'storefront-outline': Store,
    'ticket': Ticket,
    'ticket-outline': Ticket,
    'videocam-outline': Video,
    'wallet-outline': Wallet,
    'woman-outline': User,
}

interface LucideIconProps {
    /** Nom de l'icône (accepte les noms Ionicons OU les noms Lucide) */
    name: string
    size?: number
    color?: string
    strokeWidth?: number
    /** Marges ponctuelles posees par l'appelant. */
    style?: any
    /** Remplissage : utilise pour les etoiles et coeurs pleins. */
    fill?: string
}

/**
 * Composant bridge : accepte les noms d'icônes Ionicons et les convertit
 * automatiquement en icônes Lucide (cohérence avec le site web).
 */
export function LucideIcon({ name, size = 24, color, strokeWidth = 2, style, fill }: LucideIconProps) {
    const IconComponent = ICON_MAP[name]
    if (!IconComponent && __DEV__) {
        console.warn('[LucideIcon] nom sans correspondance : ' + name)
    }
    
    if (!IconComponent) {
        // Repli neutre : un cercle vaut mieux qu'un écran blanc.
        return <Circle size={size} color={color} strokeWidth={strokeWidth} />
    }

    /* ⚠️ NE JAMAIS passer `fill` ni `style` quand ils sont vides.
       Lucide construit son SVG ainsi (dist/cjs/Icon.js) :

           { ...defaultAttributes,   // fill: "none"
             ...customAttrs }        // <- nos props arrivent ici

       Étaler `fill: undefined` ÉCRASE le `fill: "none"` de Lucide. Le SVG
       retombe alors sur son remplissage par défaut, qui est NOIR : toutes
       les icônes se retrouvaient pleines de noir avec un simple liseré de
       couleur. On ne transmet donc que les propriétés réellement fournies. */
    const optionnelles: Record<string, unknown> = {}
    if (fill !== undefined) optionnelles.fill = fill
    if (style !== undefined) optionnelles.style = style

    return (
        <IconComponent
            size={size}
            color={color}
            strokeWidth={strokeWidth}
            {...optionnelles}
        />
    )
}

// Re-export toutes les icônes Lucide pour import direct
export {
    Home, FileText, Building2, Compass, Landmark, TrendingUp,
    User, Settings, Bell, Search, ChevronRight, ChevronLeft,
    ChevronDown, ChevronUp, Calendar, Clock, MapPin, Phone,
    Mail, Lock, Eye, EyeOff, Plus, Minus, X, Check,
    AlertCircle, Info, HelpCircle, Star, Heart, Share2,
    Download, Upload, Camera, Image, Shield, CreditCard,
    LogOut, Menu, Filter, Edit, Trash2, Send, MessageSquare,
    Globe, ArrowLeft, ArrowRight, ExternalLink, Copy,
    CheckCircle, XCircle, AlertTriangle,
    Undo2,
    CornerUpLeft,
    LayoutGrid,
    Layers,
    List,
    SlidersHorizontal,
    RefreshCw,
    Link,
    PencilLine,
    Images,
    Video,
    CheckCheck,
    Activity,
    ShieldCheck,
    Key,
    Fingerprint,
    File,
    Paperclip,
    Folder,
    FolderOpen,
    UploadCloud,
    Receipt,
    ScanLine,
    BookOpen,
    Library,
    MailOpen,
    MessagesSquare,
    MessageCircle,
    Headphones,
    BellOff,
    CircleUser,
    Users,
    ShoppingCart,
    ShoppingBag,
    Store,
    Banknote,
    Wallet,
    Ticket,
    Package,
    Truck,
    Plane,
    Map,
    Languages,
    Flag,
    Briefcase,
    Sparkles,
    Award,
    Lightbulb,
    Hammer,
    GitBranch,
    Network,
    Smartphone,
    CheckCircle2,
    Circle,
} from 'lucide-react-native'
