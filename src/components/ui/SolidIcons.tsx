import {
  Pulse as ActivityIcon,
  WarningCircle as AlertCircleIcon,
  TextAlignCenter as AlignCenterIcon,
  AlignCenterHorizontal as AlignHorizontalJustifyCenterIcon,
  AlignRight as AlignHorizontalJustifyEndIcon,
  AlignLeft as AlignHorizontalJustifyStartIcon,
  TextAlignLeft as AlignLeftIcon,
  TextAlignRight as AlignRightIcon,
  AlignCenterVertical as AlignVerticalJustifyCenterIcon,
  AlignBottom as AlignVerticalJustifyEndIcon,
  AlignTop as AlignVerticalJustifyStartIcon,
  Aperture as ApertureIcon,
  Article as ArticleIcon,
  ArrowDown as ArrowDownIcon,
  ArrowRight as ArrowRightIcon,
  ArrowUp as ArrowUpIcon,
  ArrowUpRight as ArrowUpRightIcon,
  Asterisk as AsteriskIcon,
  Seal as BadgeIcon,
  CirclesThreePlus as BlendIcon,
  BookBookmark as BookMarkedIcon,
  BookOpen as BookOpenIcon,
  BookOpenText as BookOpenTextIcon,
  Books as BooksIcon,
  Robot as BotIcon,
  Cube as BoxIcon,
  BracketsCurly as BracesIcon,
  Briefcase as BriefcaseBusinessIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircle2Icon,
  ChartBar as ChartBarIcon,
  ChartLineUp as ChartLineUpIcon,
  CaretDown as ChevronDownIcon,
  CaretLeft as ChevronLeftIcon,
  CaretRight as ChevronRightIcon,
  CaretUp as ChevronUpIcon,
  Circle as CircleIcon,
  CircleDashed as CircleDashedIcon,
  Gauge as CircleGaugeIcon,
  FilmSlate as ClapperboardIcon,
  Clock as Clock3Icon,
  Code as Code2Icon,
  Command as CommandIcon,
  SquaresFour as ComponentIcon,
  Copy as CopyIcon,
  CreditCard as CreditCardIcon,
  CurrencyDollar as CurrencyDollarIcon,
  CursorClick as CursorClickIcon,
  DownloadSimple as DownloadIcon,
  ArrowSquareOut as ExternalLinkIcon,
  Eye as EyeIcon,
  EyeSlash as EyeOffIcon,
  FileArrowDown as FileDownIcon,
  FileImage as FileImageIcon,
  FileCode as FileJsonIcon,
  NotePencil as FilePenLineIcon,
  FileText as FileTextIcon,
  Files as FilesIcon,
  FilmStrip as FilmIcon,
  Folder as FolderIcon,
  FrameCorners as FrameIcon,
  Gauge as GaugeIcon,
  GitBranch as GitBranchIcon,
  GitFork as GitForkIcon,
  GithubLogo as GithubIcon,
  GridFour as Grid2X2Icon,
  GridNine as Grid3X3Icon,
  SelectionAll as GroupIcon,
  ClockCounterClockwise as HistoryIcon,
  Image as ImageIcon,
  ImageSquare as ImageDownIcon,
  ImagesSquare as ImagePlusIcon,
  Images as ImagesIcon,
  Info as InfoIcon,
  Stack as Layers3Icon,
  GridFour as LayoutGridIcon,
  ListChecks as ListChecksIcon,
  TreeStructure as ListTreeIcon,
  SpinnerGap as Loader2Icon,
  EnvelopeSimple as MailIcon,
  CornersOut as Maximize2Icon,
  ChatText as MessageSquareTextIcon,
  Minus as MinusIcon,
  Monitor as MonitorIcon,
  MonitorPlay as MonitorPlayIcon,
  MonitorArrowUp as MonitorUpIcon,
  Moon as MoonIcon,
  MusicNotes as MusicIcon,
  DotsThree as MoreHorizontalIcon,
  ArrowsOutCardinal as MoveIcon,
  ArrowsOutSimple as MoveDiagonal2Icon,
  ArrowUpRight as MoveUpRightIcon,
  NavigationArrow as NavigationArrowIcon,
  Notification as NotificationIcon,
  Palette as PaletteIcon,
  SidebarSimple as PanelLeftIcon,
  SidebarSimple as PanelLeftCloseIcon,
  SidebarSimple as PanelLeftOpenIcon,
  SidebarSimple as PanelRightCloseIcon,
  SidebarSimple as PanelRightOpenIcon,
  Browser as PanelTopCloseIcon,
  Browsers as PanelsTopLeftIcon,
  Package as PackageIcon,
  Pause as PauseIcon,
  Play as PlayIcon,
  Planet as PlanetIcon,
  PlugsConnected as PlugsConnectedIcon,
  Plus as PlusIcon,
  PresentationChart as PresentationIcon,
  Quotes as QuotesIcon,
  RadioButton as RadioButtonIcon,
  Rectangle as RectangleHorizontalIcon,
  Rectangle as RectangleVerticalIcon,
  ArrowClockwise as RefreshCwIcon,
  Repeat as Repeat2Icon,
  RocketLaunch as RocketIcon,
  ArrowCounterClockwise as RotateCcwIcon,
  ArrowClockwise as RotateCwIcon,
  Rows as Rows3Icon,
  Ruler as RulerIcon,
  FloppyDisk as SaveIcon,
  Scan as ScanLineIcon,
  Scissors as ScissorsIcon,
  SealCheck as SealCheckIcon,
  MagnifyingGlass as SearchIcon,
  GearSix as SettingsIcon,
  SlidersHorizontal as Settings2Icon,
  Shapes as ShapesIcon,
  ShareNetwork as Share2Icon,
  ShieldCheck as ShieldCheckIcon,
  SkipBack as SkipBackIcon,
  SkipForward as SkipForwardIcon,
  SlidersHorizontal as SlidersHorizontalIcon,
  ArrowsHorizontal as SpaceIcon,
  Sparkle as SparklesIcon,
  Square as SquareIcon,
  Star as StarIcon,
  Sticker as StickerIcon,
  Sun as SunIcon,
  Table as TableIcon,
  Tabs as TabsIcon,
  Target as TargetIcon,
  TerminalWindow as TerminalSquareIcon,
  Trash as Trash2Icon,
  Triangle as TriangleIcon,
  TextT as TypeIcon,
  Textbox as TextboxIcon,
  ToggleLeft as ToggleLeftIcon,
  SelectionSlash as UngroupIcon,
  UploadSimple as UploadIcon,
  SpeakerHigh as Volume2Icon,
  SpeakerSlash as VolumeXIcon,
  MagicWand as WandSparklesIcon,
  Warning as WarningIcon,
  Waves as WavesIcon,
  Barbell as WeightIcon,
  TextColumns as WrapTextIcon,
  X as XIcon,
  Lightning as ZapIcon,
  MagnifyingGlassPlus as ZoomInIcon,
  MagnifyingGlassMinus as ZoomOutIcon,
} from '@phosphor-icons/react/ssr';
import { forwardRef } from 'react';

import type { Icon, IconProps } from '@phosphor-icons/react';

function weightedIcon(
  Source: Icon,
  displayName: string,
  defaultWeight: NonNullable<IconProps['weight']>
): Icon {
  const WeightedIcon = forwardRef<SVGSVGElement, IconProps>(({ weight = defaultWeight, ...props }, ref) => (
    <Source ref={ref} weight={weight} {...props} />
  ));
  WeightedIcon.displayName = displayName;
  return WeightedIcon;
}

const solidIcon = (Source: Icon, displayName: string) => weightedIcon(Source, displayName, 'fill');
const lineIcon = (Source: Icon, displayName: string) => weightedIcon(Source, displayName, 'regular');

export type LucideIcon = Icon;

// Filled silhouettes identify objects and content types; line icons preserve detail for controls and state.
export const Activity = lineIcon(ActivityIcon, 'Activity');
export const AlertCircle = lineIcon(AlertCircleIcon, 'AlertCircle');
export const AlignCenter = lineIcon(AlignCenterIcon, 'AlignCenter');
export const AlignHorizontalJustifyCenter = lineIcon(AlignHorizontalJustifyCenterIcon, 'AlignHorizontalJustifyCenter');
export const AlignHorizontalJustifyEnd = lineIcon(AlignHorizontalJustifyEndIcon, 'AlignHorizontalJustifyEnd');
export const AlignHorizontalJustifyStart = lineIcon(AlignHorizontalJustifyStartIcon, 'AlignHorizontalJustifyStart');
export const AlignLeft = lineIcon(AlignLeftIcon, 'AlignLeft');
export const AlignRight = lineIcon(AlignRightIcon, 'AlignRight');
export const AlignVerticalJustifyCenter = lineIcon(AlignVerticalJustifyCenterIcon, 'AlignVerticalJustifyCenter');
export const AlignVerticalJustifyEnd = lineIcon(AlignVerticalJustifyEndIcon, 'AlignVerticalJustifyEnd');
export const AlignVerticalJustifyStart = lineIcon(AlignVerticalJustifyStartIcon, 'AlignVerticalJustifyStart');
export const Aperture = lineIcon(ApertureIcon, 'Aperture');
export const Article = lineIcon(ArticleIcon, 'Article');
export const ArrowDown = lineIcon(ArrowDownIcon, 'ArrowDown');
export const ArrowRight = lineIcon(ArrowRightIcon, 'ArrowRight');
export const ArrowUp = lineIcon(ArrowUpIcon, 'ArrowUp');
export const ArrowUpRight = lineIcon(ArrowUpRightIcon, 'ArrowUpRight');
export const Asterisk = solidIcon(AsteriskIcon, 'Asterisk');
export const Badge = solidIcon(BadgeIcon, 'Badge');
export const Blend = lineIcon(BlendIcon, 'Blend');
export const BookMarked = lineIcon(BookMarkedIcon, 'BookMarked');
export const BookOpen = lineIcon(BookOpenIcon, 'BookOpen');
export const BookOpenText = lineIcon(BookOpenTextIcon, 'BookOpenText');
export const Books = solidIcon(BooksIcon, 'Books');
export const Bot = solidIcon(BotIcon, 'Bot');
export const Box = solidIcon(BoxIcon, 'Box');
export const Braces = lineIcon(BracesIcon, 'Braces');
export const BriefcaseBusiness = solidIcon(BriefcaseBusinessIcon, 'BriefcaseBusiness');
export const Check = lineIcon(CheckIcon, 'Check');
export const CheckCircle2 = lineIcon(CheckCircle2Icon, 'CheckCircle2');
export const ChartBar = lineIcon(ChartBarIcon, 'ChartBar');
export const ChartLineUp = lineIcon(ChartLineUpIcon, 'ChartLineUp');
export const ChevronDown = lineIcon(ChevronDownIcon, 'ChevronDown');
export const ChevronLeft = lineIcon(ChevronLeftIcon, 'ChevronLeft');
export const ChevronRight = lineIcon(ChevronRightIcon, 'ChevronRight');
export const ChevronUp = lineIcon(ChevronUpIcon, 'ChevronUp');
export const Circle = lineIcon(CircleIcon, 'Circle');
export const CircleDashed = lineIcon(CircleDashedIcon, 'CircleDashed');
export const CircleGauge = lineIcon(CircleGaugeIcon, 'CircleGauge');
export const Clapperboard = solidIcon(ClapperboardIcon, 'Clapperboard');
export const Clock3 = lineIcon(Clock3Icon, 'Clock3');
export const Code2 = lineIcon(Code2Icon, 'Code2');
export const Command = lineIcon(CommandIcon, 'Command');
export const Component = solidIcon(ComponentIcon, 'Component');
export const Copy = lineIcon(CopyIcon, 'Copy');
export const CreditCard = lineIcon(CreditCardIcon, 'CreditCard');
export const CurrencyDollar = lineIcon(CurrencyDollarIcon, 'CurrencyDollar');
export const CursorClick = lineIcon(CursorClickIcon, 'CursorClick');
export const Download = lineIcon(DownloadIcon, 'Download');
export const ExternalLink = lineIcon(ExternalLinkIcon, 'ExternalLink');
export const Eye = lineIcon(EyeIcon, 'Eye');
export const EyeOff = lineIcon(EyeOffIcon, 'EyeOff');
export const FileDown = lineIcon(FileDownIcon, 'FileDown');
export const FileImage = lineIcon(FileImageIcon, 'FileImage');
export const FileJson = lineIcon(FileJsonIcon, 'FileJson');
export const FileJson2 = lineIcon(FileJsonIcon, 'FileJson2');
export const FilePenLine = lineIcon(FilePenLineIcon, 'FilePenLine');
export const FileText = lineIcon(FileTextIcon, 'FileText');
export const Files = lineIcon(FilesIcon, 'Files');
export const Film = solidIcon(FilmIcon, 'Film');
export const Folder = solidIcon(FolderIcon, 'Folder');
export const Frame = lineIcon(FrameIcon, 'Frame');
export const Gauge = lineIcon(GaugeIcon, 'Gauge');
export const GitBranch = solidIcon(GitBranchIcon, 'GitBranch');
export const GitFork = lineIcon(GitForkIcon, 'GitFork');
export const Github = solidIcon(GithubIcon, 'Github');
export const Grid2X2 = lineIcon(Grid2X2Icon, 'Grid2X2');
export const Grid3X3 = lineIcon(Grid3X3Icon, 'Grid3X3');
export const Group = lineIcon(GroupIcon, 'Group');
export const History = lineIcon(HistoryIcon, 'History');
export const Image = solidIcon(ImageIcon, 'Image');
export const ImageDown = lineIcon(ImageDownIcon, 'ImageDown');
export const ImagePlus = lineIcon(ImagePlusIcon, 'ImagePlus');
export const Images = solidIcon(ImagesIcon, 'Images');
export const Info = lineIcon(InfoIcon, 'Info');
export const Layers3 = solidIcon(Layers3Icon, 'Layers3');
export const LayoutGrid = lineIcon(LayoutGridIcon, 'LayoutGrid');
export const ListChecks = lineIcon(ListChecksIcon, 'ListChecks');
export const ListTree = lineIcon(ListTreeIcon, 'ListTree');
export const Loader2 = lineIcon(Loader2Icon, 'Loader2');
export const Mail = solidIcon(MailIcon, 'Mail');
export const Maximize2 = lineIcon(Maximize2Icon, 'Maximize2');
export const MessageSquareText = solidIcon(MessageSquareTextIcon, 'MessageSquareText');
export const Minus = lineIcon(MinusIcon, 'Minus');
export const Monitor = lineIcon(MonitorIcon, 'Monitor');
export const MonitorPlay = lineIcon(MonitorPlayIcon, 'MonitorPlay');
export const MonitorUp = lineIcon(MonitorUpIcon, 'MonitorUp');
export const Moon = lineIcon(MoonIcon, 'Moon');
export const Music = solidIcon(MusicIcon, 'Music');
export const MoreHorizontal = lineIcon(MoreHorizontalIcon, 'MoreHorizontal');
export const Move = lineIcon(MoveIcon, 'Move');
export const MoveDiagonal2 = lineIcon(MoveDiagonal2Icon, 'MoveDiagonal2');
export const MoveUpRight = lineIcon(MoveUpRightIcon, 'MoveUpRight');
export const NavigationArrow = lineIcon(NavigationArrowIcon, 'NavigationArrow');
export const Notification = lineIcon(NotificationIcon, 'Notification');
export const Palette = solidIcon(PaletteIcon, 'Palette');
export const PanelLeft = lineIcon(PanelLeftIcon, 'PanelLeft');
export const PanelLeftClose = lineIcon(PanelLeftCloseIcon, 'PanelLeftClose');
export const PanelLeftOpen = lineIcon(PanelLeftOpenIcon, 'PanelLeftOpen');
export const PanelRightClose = lineIcon(PanelRightCloseIcon, 'PanelRightClose');
export const PanelRightOpen = lineIcon(PanelRightOpenIcon, 'PanelRightOpen');
export const PanelTopClose = lineIcon(PanelTopCloseIcon, 'PanelTopClose');
export const PanelsTopLeft = lineIcon(PanelsTopLeftIcon, 'PanelsTopLeft');
export const Package = solidIcon(PackageIcon, 'Package');
export const Pause = solidIcon(PauseIcon, 'Pause');
export const Play = solidIcon(PlayIcon, 'Play');
export const Planet = solidIcon(PlanetIcon, 'Planet');
export const PlugsConnected = solidIcon(PlugsConnectedIcon, 'PlugsConnected');
export const Plus = lineIcon(PlusIcon, 'Plus');
export const Presentation = solidIcon(PresentationIcon, 'Presentation');
export const Quotes = lineIcon(QuotesIcon, 'Quotes');
export const RadioButton = lineIcon(RadioButtonIcon, 'RadioButton');
export const RectangleHorizontal = lineIcon(RectangleHorizontalIcon, 'RectangleHorizontal');
export const RectangleVertical = lineIcon(RectangleVerticalIcon, 'RectangleVertical');
export const RefreshCw = lineIcon(RefreshCwIcon, 'RefreshCw');
export const Repeat2 = lineIcon(Repeat2Icon, 'Repeat2');
export const Rocket = solidIcon(RocketIcon, 'Rocket');
export const RotateCcw = lineIcon(RotateCcwIcon, 'RotateCcw');
export const RotateCw = lineIcon(RotateCwIcon, 'RotateCw');
export const Rows3 = lineIcon(Rows3Icon, 'Rows3');
export const Ruler = lineIcon(RulerIcon, 'Ruler');
export const Save = lineIcon(SaveIcon, 'Save');
export const ScanLine = lineIcon(ScanLineIcon, 'ScanLine');
export const Scissors = lineIcon(ScissorsIcon, 'Scissors');
export const SealCheck = solidIcon(SealCheckIcon, 'SealCheck');
export const Search = lineIcon(SearchIcon, 'Search');
export const Settings = lineIcon(SettingsIcon, 'Settings');
export const Settings2 = lineIcon(Settings2Icon, 'Settings2');
export const Shapes = solidIcon(ShapesIcon, 'Shapes');
export const Share2 = lineIcon(Share2Icon, 'Share2');
export const ShieldCheck = solidIcon(ShieldCheckIcon, 'ShieldCheck');
export const SkipBack = solidIcon(SkipBackIcon, 'SkipBack');
export const SkipForward = solidIcon(SkipForwardIcon, 'SkipForward');
export const SlidersHorizontal = lineIcon(SlidersHorizontalIcon, 'SlidersHorizontal');
export const Space = lineIcon(SpaceIcon, 'Space');
export const Sparkles = solidIcon(SparklesIcon, 'Sparkles');
export const Square = solidIcon(SquareIcon, 'Square');
export const Star = solidIcon(StarIcon, 'Star');
export const Sticker = solidIcon(StickerIcon, 'Sticker');
export const Sun = lineIcon(SunIcon, 'Sun');
export const Table = lineIcon(TableIcon, 'Table');
export const Tabs = lineIcon(TabsIcon, 'Tabs');
export const Target = lineIcon(TargetIcon, 'Target');
export const TerminalSquare = lineIcon(TerminalSquareIcon, 'TerminalSquare');
export const Trash2 = lineIcon(Trash2Icon, 'Trash2');
export const Triangle = solidIcon(TriangleIcon, 'Triangle');
export const Type = solidIcon(TypeIcon, 'Type');
export const Textbox = lineIcon(TextboxIcon, 'Textbox');
export const ToggleLeft = lineIcon(ToggleLeftIcon, 'ToggleLeft');
export const Ungroup = lineIcon(UngroupIcon, 'Ungroup');
export const Upload = lineIcon(UploadIcon, 'Upload');
export const Volume2 = lineIcon(Volume2Icon, 'Volume2');
export const VolumeX = lineIcon(VolumeXIcon, 'VolumeX');
export const WandSparkles = solidIcon(WandSparklesIcon, 'WandSparkles');
export const Warning = solidIcon(WarningIcon, 'Warning');
export const Waves = lineIcon(WavesIcon, 'Waves');
export const Weight = solidIcon(WeightIcon, 'Weight');
export const WrapText = lineIcon(WrapTextIcon, 'WrapText');
export const X = lineIcon(XIcon, 'X');
export const Zap = solidIcon(ZapIcon, 'Zap');
export const ZoomIn = lineIcon(ZoomInIcon, 'ZoomIn');
export const ZoomOut = lineIcon(ZoomOutIcon, 'ZoomOut');
