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
  Robot as BotIcon,
  Cube as BoxIcon,
  BracketsCurly as BracesIcon,
  Briefcase as BriefcaseBusinessIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircle2Icon,
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
  SquaresFour as ComponentIcon,
  Copy as CopyIcon,
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
  GitFork as GitForkIcon,
  GithubLogo as GithubIcon,
  GridFour as Grid2X2Icon,
  GridNine as Grid3X3Icon,
  SelectionAll as GroupIcon,
  ClockCounterClockwise as HistoryIcon,
  Image as ImageIcon,
  ImageSquare as ImageDownIcon,
  ImagesSquare as ImagePlusIcon,
  Stack as Layers3Icon,
  GridFour as LayoutGridIcon,
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
  DotsThree as MoreHorizontalIcon,
  ArrowsOutCardinal as MoveIcon,
  ArrowsOutSimple as MoveDiagonal2Icon,
  ArrowUpRight as MoveUpRightIcon,
  Palette as PaletteIcon,
  SidebarSimple as PanelLeftIcon,
  SidebarSimple as PanelLeftCloseIcon,
  SidebarSimple as PanelLeftOpenIcon,
  SidebarSimple as PanelRightCloseIcon,
  SidebarSimple as PanelRightOpenIcon,
  Browser as PanelTopCloseIcon,
  Browsers as PanelsTopLeftIcon,
  Pause as PauseIcon,
  Play as PlayIcon,
  Plus as PlusIcon,
  PresentationChart as PresentationIcon,
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
  MagnifyingGlass as SearchIcon,
  GearSix as SettingsIcon,
  SlidersHorizontal as Settings2Icon,
  Shapes as ShapesIcon,
  ShareNetwork as Share2Icon,
  SkipBack as SkipBackIcon,
  SkipForward as SkipForwardIcon,
  SlidersHorizontal as SlidersHorizontalIcon,
  ArrowsHorizontal as SpaceIcon,
  Sparkle as SparklesIcon,
  Square as SquareIcon,
  Star as StarIcon,
  Sticker as StickerIcon,
  Sun as SunIcon,
  Target as TargetIcon,
  TerminalWindow as TerminalSquareIcon,
  Trash as Trash2Icon,
  Triangle as TriangleIcon,
  TextT as TypeIcon,
  SelectionSlash as UngroupIcon,
  UploadSimple as UploadIcon,
  MagicWand as WandSparklesIcon,
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

function solidIcon(Source: Icon, displayName: string): Icon {
  const SolidIcon = forwardRef<SVGSVGElement, IconProps>(({ weight = 'fill', ...props }, ref) => (
    <Source ref={ref} weight={weight} {...props} />
  ));
  SolidIcon.displayName = displayName;
  return SolidIcon;
}

export type LucideIcon = Icon;

export const Activity = solidIcon(ActivityIcon, 'Activity');
export const AlertCircle = solidIcon(AlertCircleIcon, 'AlertCircle');
export const AlignCenter = solidIcon(AlignCenterIcon, 'AlignCenter');
export const AlignHorizontalJustifyCenter = solidIcon(AlignHorizontalJustifyCenterIcon, 'AlignHorizontalJustifyCenter');
export const AlignHorizontalJustifyEnd = solidIcon(AlignHorizontalJustifyEndIcon, 'AlignHorizontalJustifyEnd');
export const AlignHorizontalJustifyStart = solidIcon(AlignHorizontalJustifyStartIcon, 'AlignHorizontalJustifyStart');
export const AlignLeft = solidIcon(AlignLeftIcon, 'AlignLeft');
export const AlignRight = solidIcon(AlignRightIcon, 'AlignRight');
export const AlignVerticalJustifyCenter = solidIcon(AlignVerticalJustifyCenterIcon, 'AlignVerticalJustifyCenter');
export const AlignVerticalJustifyEnd = solidIcon(AlignVerticalJustifyEndIcon, 'AlignVerticalJustifyEnd');
export const AlignVerticalJustifyStart = solidIcon(AlignVerticalJustifyStartIcon, 'AlignVerticalJustifyStart');
export const Aperture = solidIcon(ApertureIcon, 'Aperture');
export const ArrowDown = solidIcon(ArrowDownIcon, 'ArrowDown');
export const ArrowRight = solidIcon(ArrowRightIcon, 'ArrowRight');
export const ArrowUp = solidIcon(ArrowUpIcon, 'ArrowUp');
export const ArrowUpRight = solidIcon(ArrowUpRightIcon, 'ArrowUpRight');
export const Asterisk = solidIcon(AsteriskIcon, 'Asterisk');
export const Badge = solidIcon(BadgeIcon, 'Badge');
export const Blend = solidIcon(BlendIcon, 'Blend');
export const BookMarked = solidIcon(BookMarkedIcon, 'BookMarked');
export const BookOpen = solidIcon(BookOpenIcon, 'BookOpen');
export const BookOpenText = solidIcon(BookOpenTextIcon, 'BookOpenText');
export const Bot = solidIcon(BotIcon, 'Bot');
export const Box = solidIcon(BoxIcon, 'Box');
export const Braces = solidIcon(BracesIcon, 'Braces');
export const BriefcaseBusiness = solidIcon(BriefcaseBusinessIcon, 'BriefcaseBusiness');
export const Check = solidIcon(CheckIcon, 'Check');
export const CheckCircle2 = solidIcon(CheckCircle2Icon, 'CheckCircle2');
export const ChevronDown = solidIcon(ChevronDownIcon, 'ChevronDown');
export const ChevronLeft = solidIcon(ChevronLeftIcon, 'ChevronLeft');
export const ChevronRight = solidIcon(ChevronRightIcon, 'ChevronRight');
export const ChevronUp = solidIcon(ChevronUpIcon, 'ChevronUp');
export const Circle = solidIcon(CircleIcon, 'Circle');
export const CircleDashed = solidIcon(CircleDashedIcon, 'CircleDashed');
export const CircleGauge = solidIcon(CircleGaugeIcon, 'CircleGauge');
export const Clapperboard = solidIcon(ClapperboardIcon, 'Clapperboard');
export const Clock3 = solidIcon(Clock3Icon, 'Clock3');
export const Code2 = solidIcon(Code2Icon, 'Code2');
export const Component = solidIcon(ComponentIcon, 'Component');
export const Copy = solidIcon(CopyIcon, 'Copy');
export const Download = solidIcon(DownloadIcon, 'Download');
export const ExternalLink = solidIcon(ExternalLinkIcon, 'ExternalLink');
export const Eye = solidIcon(EyeIcon, 'Eye');
export const EyeOff = solidIcon(EyeOffIcon, 'EyeOff');
export const FileDown = solidIcon(FileDownIcon, 'FileDown');
export const FileImage = solidIcon(FileImageIcon, 'FileImage');
export const FileJson = solidIcon(FileJsonIcon, 'FileJson');
export const FileJson2 = solidIcon(FileJsonIcon, 'FileJson2');
export const FilePenLine = solidIcon(FilePenLineIcon, 'FilePenLine');
export const FileText = solidIcon(FileTextIcon, 'FileText');
export const Files = solidIcon(FilesIcon, 'Files');
export const Film = solidIcon(FilmIcon, 'Film');
export const Folder = solidIcon(FolderIcon, 'Folder');
export const Frame = solidIcon(FrameIcon, 'Frame');
export const Gauge = solidIcon(GaugeIcon, 'Gauge');
export const GitFork = solidIcon(GitForkIcon, 'GitFork');
export const Github = solidIcon(GithubIcon, 'Github');
export const Grid2X2 = solidIcon(Grid2X2Icon, 'Grid2X2');
export const Grid3X3 = solidIcon(Grid3X3Icon, 'Grid3X3');
export const Group = solidIcon(GroupIcon, 'Group');
export const History = solidIcon(HistoryIcon, 'History');
export const Image = solidIcon(ImageIcon, 'Image');
export const ImageDown = solidIcon(ImageDownIcon, 'ImageDown');
export const ImagePlus = solidIcon(ImagePlusIcon, 'ImagePlus');
export const Layers3 = solidIcon(Layers3Icon, 'Layers3');
export const LayoutGrid = solidIcon(LayoutGridIcon, 'LayoutGrid');
export const ListTree = solidIcon(ListTreeIcon, 'ListTree');
export const Loader2 = solidIcon(Loader2Icon, 'Loader2');
export const Mail = solidIcon(MailIcon, 'Mail');
export const Maximize2 = solidIcon(Maximize2Icon, 'Maximize2');
export const MessageSquareText = solidIcon(MessageSquareTextIcon, 'MessageSquareText');
export const Minus = solidIcon(MinusIcon, 'Minus');
export const Monitor = solidIcon(MonitorIcon, 'Monitor');
export const MonitorPlay = solidIcon(MonitorPlayIcon, 'MonitorPlay');
export const MonitorUp = solidIcon(MonitorUpIcon, 'MonitorUp');
export const Moon = solidIcon(MoonIcon, 'Moon');
export const MoreHorizontal = solidIcon(MoreHorizontalIcon, 'MoreHorizontal');
export const Move = solidIcon(MoveIcon, 'Move');
export const MoveDiagonal2 = solidIcon(MoveDiagonal2Icon, 'MoveDiagonal2');
export const MoveUpRight = solidIcon(MoveUpRightIcon, 'MoveUpRight');
export const Palette = solidIcon(PaletteIcon, 'Palette');
export const PanelLeft = solidIcon(PanelLeftIcon, 'PanelLeft');
export const PanelLeftClose = solidIcon(PanelLeftCloseIcon, 'PanelLeftClose');
export const PanelLeftOpen = solidIcon(PanelLeftOpenIcon, 'PanelLeftOpen');
export const PanelRightClose = solidIcon(PanelRightCloseIcon, 'PanelRightClose');
export const PanelRightOpen = solidIcon(PanelRightOpenIcon, 'PanelRightOpen');
export const PanelTopClose = solidIcon(PanelTopCloseIcon, 'PanelTopClose');
export const PanelsTopLeft = solidIcon(PanelsTopLeftIcon, 'PanelsTopLeft');
export const Pause = solidIcon(PauseIcon, 'Pause');
export const Play = solidIcon(PlayIcon, 'Play');
export const Plus = solidIcon(PlusIcon, 'Plus');
export const Presentation = solidIcon(PresentationIcon, 'Presentation');
export const RectangleHorizontal = solidIcon(RectangleHorizontalIcon, 'RectangleHorizontal');
export const RectangleVertical = solidIcon(RectangleVerticalIcon, 'RectangleVertical');
export const RefreshCw = solidIcon(RefreshCwIcon, 'RefreshCw');
export const Repeat2 = solidIcon(Repeat2Icon, 'Repeat2');
export const Rocket = solidIcon(RocketIcon, 'Rocket');
export const RotateCcw = solidIcon(RotateCcwIcon, 'RotateCcw');
export const RotateCw = solidIcon(RotateCwIcon, 'RotateCw');
export const Rows3 = solidIcon(Rows3Icon, 'Rows3');
export const Ruler = solidIcon(RulerIcon, 'Ruler');
export const Save = solidIcon(SaveIcon, 'Save');
export const ScanLine = solidIcon(ScanLineIcon, 'ScanLine');
export const Search = solidIcon(SearchIcon, 'Search');
export const Settings = solidIcon(SettingsIcon, 'Settings');
export const Settings2 = solidIcon(Settings2Icon, 'Settings2');
export const Shapes = solidIcon(ShapesIcon, 'Shapes');
export const Share2 = solidIcon(Share2Icon, 'Share2');
export const SkipBack = solidIcon(SkipBackIcon, 'SkipBack');
export const SkipForward = solidIcon(SkipForwardIcon, 'SkipForward');
export const SlidersHorizontal = solidIcon(SlidersHorizontalIcon, 'SlidersHorizontal');
export const Space = solidIcon(SpaceIcon, 'Space');
export const Sparkles = solidIcon(SparklesIcon, 'Sparkles');
export const Square = solidIcon(SquareIcon, 'Square');
export const Star = solidIcon(StarIcon, 'Star');
export const Sticker = solidIcon(StickerIcon, 'Sticker');
export const Sun = solidIcon(SunIcon, 'Sun');
export const Target = solidIcon(TargetIcon, 'Target');
export const TerminalSquare = solidIcon(TerminalSquareIcon, 'TerminalSquare');
export const Trash2 = solidIcon(Trash2Icon, 'Trash2');
export const Triangle = solidIcon(TriangleIcon, 'Triangle');
export const Type = solidIcon(TypeIcon, 'Type');
export const Ungroup = solidIcon(UngroupIcon, 'Ungroup');
export const Upload = solidIcon(UploadIcon, 'Upload');
export const WandSparkles = solidIcon(WandSparklesIcon, 'WandSparkles');
export const Waves = solidIcon(WavesIcon, 'Waves');
export const Weight = solidIcon(WeightIcon, 'Weight');
export const WrapText = solidIcon(WrapTextIcon, 'WrapText');
export const X = solidIcon(XIcon, 'X');
export const Zap = solidIcon(ZapIcon, 'Zap');
export const ZoomIn = solidIcon(ZoomInIcon, 'ZoomIn');
export const ZoomOut = solidIcon(ZoomOutIcon, 'ZoomOut');
