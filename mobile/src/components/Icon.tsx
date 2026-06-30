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
    ChevronDown, ChevronUp, Calendar, Clock, MapPin, Phone,
    Mail, Lock, Eye, EyeOff, Plus, Minus, X, Check, 
    AlertCircle, Info, HelpCircle, Star, Heart, Share2,
    Download, Upload, Camera, Image, Shield, CreditCard,
    LogOut, Menu, Filter, Edit, Trash2, Send, MessageSquare,
    Globe, ArrowLeft, ArrowRight, ExternalLink, Copy,
    CheckCircle, XCircle, AlertTriangle, type LucideProps,
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
}

interface LucideIconProps {
    /** Nom de l'icône (accepte les noms Ionicons OU les noms Lucide) */
    name: string
    size?: number
    color?: string
    strokeWidth?: number
}

/**
 * Composant bridge : accepte les noms d'icônes Ionicons et les convertit
 * automatiquement en icônes Lucide (cohérence avec le site web).
 */
export function LucideIcon({ name, size = 24, color = '#F2F2F2', strokeWidth = 1.75 }: LucideIconProps) {
    const IconComponent = ICON_MAP[name]
    
    if (!IconComponent) {
        // Fallback : si l'icône n'est pas dans le mapping, afficher un cercle info
        return <Info size={size} color={color} strokeWidth={strokeWidth} />
    }
    
    return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />
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
} from 'lucide-react-native'
