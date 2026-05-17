/**
 * AForce icon system — single source of truth.
 *
 * Per the AForce OS Master Update Spec ("Android Icon Fix"):
 *
 *   1. ONE icon system only — Lucide React Native.
 *   2. Standardized sizes: xs 14 / sm 18 / md 22 / lg 28 / xl 36.
 *   3. Force strokeWidth = 2.2 so iOS and Android render at the
 *      same visual weight.
 *   4. Dark-mode minimum icon opacity: rgba(255,255,255,0.92) —
 *      no faded glyphs on Android OLED.
 *   5. Single token file (this one) used by every icon surface.
 *
 * The `<Icon />` wrapper in `components/Icon.tsx` reads these
 * tokens and resolves a Feather-style name (e.g. "alert-triangle")
 * to the matching Lucide component so existing call sites keep
 * working unchanged during the migration sweep.
 */

import {
  // Status / system
  Check,
  X,
  CircleCheck,
  CircleAlert,
  TriangleAlert,
  OctagonAlert,
  CircleHelp,
  Info,
  Eye,
  Lock,
  Shield,
  Bell,
  BellRing,
  Sparkles,
  // Navigation
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  CircleArrowRight,
  Plus,
  Minus,
  Slash,
  Square,
  ExternalLink,
  // People / social
  User,
  UserPlus,
  Users,
  MessageCircle,
  Heart,
  Star,
  Award,
  Crown,
  // Body / health / activity
  Activity,
  Droplet,
  Heart as HeartGlyph,
  Zap,
  Footprints,
  Scan,
  // Environment / weather
  Thermometer,
  Sun,
  Moon,
  Sunrise,
  Wind,
  Cloud,
  MapPin,
  Navigation,
  Compass,
  Anchor,
  Ship,
  Sailboat,
  // Data / charts
  ChartBar,
  TrendingUp,
  TrendingDown,
  Battery,
  Cpu,
  RefreshCw,
  Repeat,
  Clock,
  Calendar,
  // Commerce / files
  ShoppingCart,
  ShoppingBag,
  Package,
  Truck,
  CreditCard,
  Download,
  Upload,
  CloudUpload,
  FilePlus,
  Notebook,
  BookOpen,
  // Media / device
  Camera,
  CameraOff,
  VolumeX,
  Volume2,
  Watch,
  // Settings / controls
  Settings,
  SlidersHorizontal,
  Search,
  Grid3x3,
  List,
  Share,
  Share2,
  Maximize2,
  Pencil,
  SquarePen,
  // Lifestyle
  Wine,
  LogOut,
  Tent,
  Coffee,
  // Device / connectivity
  Bluetooth,
  WifiOff,
  Loader,
  Smartphone,
  // Misc UI
  Maximize,
  Map,
  Flag,
  Send,
  MessageSquare,
  Ellipsis,
  FileText,
  Target,
  Type,
  type LucideIcon,
} from 'lucide-react-native';

/* ───────────────────────── size scale ───────────────────────── */

export const IconSizes = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
} as const;
export type IconSizeToken = keyof typeof IconSizes;

/** Default size when none is specified. md = 22 reads well on both phones. */
export const DEFAULT_ICON_SIZE = IconSizes.md;

/** Forced stroke weight. Higher than Lucide's 2.0 default so glyphs
 *  don't render thin on Android. */
export const DEFAULT_STROKE_WIDTH = 2.2;

/** Minimum opacity for any icon in dark mode. Anything below this
 *  becomes invisible on Android OLED panels. */
export const MIN_ICON_OPACITY = 0.92;
export const MIN_ICON_COLOR_DARK = 'rgba(255,255,255,0.92)';

/** Subtle glow recipe — passed to `style.textShadow*` on the host
 *  text node to lift a glyph on true-black backgrounds. */
export const IconGlow = {
  none: { textShadowRadius: 0 },
  soft: { textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
  hero: { textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
} as const;
export type IconGlowToken = keyof typeof IconGlow;

/** Resolve a size token or raw pixel value to a number. */
export function resolveIconSize(size: IconSizeToken | number | undefined): number {
  if (typeof size === 'number') return size;
  if (size && size in IconSizes) return IconSizes[size];
  return DEFAULT_ICON_SIZE;
}

/* ───────────────────────── name map ───────────────────────── */

/**
 * Feather-style kebab-case name → Lucide component.
 *
 * Lets the existing `<Icon name="alert-triangle" />` API keep
 * working while the underlying pack swaps to Lucide. Names absent
 * from the map fall back to Feather in the wrapper (logged in dev)
 * so the migration sweep can land file-by-file without breakage.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  // status
  check: Check,
  x: X,
  'check-circle': CircleCheck,
  'alert-circle': CircleAlert,
  'alert-triangle': TriangleAlert,
  'alert-octagon': OctagonAlert,
  'help-circle': CircleHelp,
  info: Info,
  eye: Eye,
  lock: Lock,
  shield: Shield,
  bell: Bell,
  'bell-ring': BellRing,
  sparkles: Sparkles,
  // navigation
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-up-right': ArrowUpRight,
  'arrow-right-circle': CircleArrowRight,
  plus: Plus,
  minus: Minus,
  slash: Slash,
  square: Square,
  'external-link': ExternalLink,
  // people / social
  user: User,
  'user-plus': UserPlus,
  users: Users,
  'message-circle': MessageCircle,
  heart: Heart,
  star: Star,
  award: Award,
  crown: Crown,
  // body / activity
  activity: Activity,
  droplet: Droplet,
  zap: Zap,
  footprints: Footprints,
  scan: Scan,
  // environment / weather
  thermometer: Thermometer,
  sun: Sun,
  moon: Moon,
  sunrise: Sunrise,
  wind: Wind,
  cloud: Cloud,
  'map-pin': MapPin,
  navigation: Navigation,
  compass: Compass,
  anchor: Anchor,
  ship: Ship,
  sailboat: Sailboat,
  // data / charts
  'bar-chart-2': ChartBar,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  battery: Battery,
  cpu: Cpu,
  'refresh-cw': RefreshCw,
  repeat: Repeat,
  clock: Clock,
  calendar: Calendar,
  // commerce / files
  cart: ShoppingCart,
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  package: Package,
  truck: Truck,
  'credit-card': CreditCard,
  download: Download,
  upload: Upload,
  'upload-cloud': CloudUpload,
  'file-plus': FilePlus,
  notebook: Notebook,
  'book-open': BookOpen,
  // media / device
  camera: Camera,
  'camera-off': CameraOff,
  'volume-x': VolumeX,
  'volume-2': Volume2,
  watch: Watch,
  // settings / controls
  settings: Settings,
  sliders: SlidersHorizontal,
  search: Search,
  grid: Grid3x3,
  list: List,
  share: Share,
  'share-2': Share2,
  'maximize-2': Maximize2,
  'edit-2': SquarePen,
  'edit-3': Pencil,
  // lifestyle
  wineglass: Wine,
  wine: Wine,
  'log-out': LogOut,
  tent: Tent,
  coffee: Coffee,
  // device / connectivity
  bluetooth: Bluetooth,
  'wifi-off': WifiOff,
  loader: Loader,
  smartphone: Smartphone,
  // misc UI
  maximize: Maximize,
  map: Map,
  flag: Flag,
  send: Send,
  'message-square': MessageSquare,
  'more-horizontal': Ellipsis,
  'file-text': FileText,
  target: Target,
  type: Type,

  // ─── semantic AForce names (used as tab/route icons) ──────
  cruise: Ship,
  heat: Thermometer,
  journal: Notebook,
  notifications: Bell,
  phantom: Sparkles,
  profile: User,
  protocol: Shield,
  ring: Watch,
  social: Users,
  store: ShoppingBag,
  subscription: Crown,
  competition: Award,
  welcome: Sparkles,
  splash: Sparkles,
  index: Activity,
};

export type IconName = keyof typeof ICON_MAP | string;

/** Resolve a Feather-style name to a Lucide component. Returns null
 *  when no mapping exists — the wrapper handles fallback. */
export function lookupIcon(name: string): LucideIcon | null {
  return ICON_MAP[name] ?? null;
}

// Suppress unused-import lint for the deliberate alias re-export.
void HeartGlyph;
