import type { Element } from '../schema/Element'

export type EventCategory =
  | 'music'
  | 'business'
  | 'sports'
  | 'hackathon'
  | 'robotics'
  | 'cultural'
  | 'conference'
  | 'gaming'
  | 'workshop'
  | 'general'

export interface ThemeColors {
  d1HeaderBg: string
  d1LowerBg: string
  d1HeaderTextColor: string
  d1BadgeColor: string
  d1Accent: string
  d1RingStroke: string
  d2HeroBg: string
  d2LowerBg: string
  d2Accent: string
  d2NameColor: string
  d2TeamColor: string
  d2BarcodeFg: string
  d2BarcodeBg: string
  d3ObsidianBg: string
  d3Accent: string
  d3RoleHighlight: string
}

export const THEME_COLOR_PALETTES: Record<EventCategory, ThemeColors> = {
  music: {
    d1HeaderBg: '#130424',
    d1LowerBg: '#080112',
    d1HeaderTextColor: '#ffffff',
    d1BadgeColor: '#f472b6',
    d1Accent: '#ec4899',
    d1RingStroke: '#ec4899',
    d2HeroBg: '#0e0322',
    d2LowerBg: '#120526',
    d2Accent: '#d946ef',
    d2NameColor: '#ffffff',
    d2TeamColor: '#c084fc',
    d2BarcodeFg: '#ffffff',
    d2BarcodeBg: '#120526',
    d3ObsidianBg: '#070110',
    d3Accent: '#d946ef',
    d3RoleHighlight: '#f472b6',
  },
  business: {
    d1HeaderBg: '#0b1329',
    d1LowerBg: '#060a17',
    d1HeaderTextColor: '#ffffff',
    d1BadgeColor: '#f59e0b',
    d1Accent: '#f59e0b',
    d1RingStroke: '#fbbf24',
    d2HeroBg: '#0a1128',
    d2LowerBg: '#0e1738',
    d2Accent: '#10b981',
    d2NameColor: '#ffffff',
    d2TeamColor: '#34d399',
    d2BarcodeFg: '#ffffff',
    d2BarcodeBg: '#0e1738',
    d3ObsidianBg: '#060a14',
    d3Accent: '#f59e0b',
    d3RoleHighlight: '#fbbf24',
  },
  sports: {
    d1HeaderBg: '#0a192f',
    d1LowerBg: '#06101e',
    d1HeaderTextColor: '#ffffff',
    d1BadgeColor: '#38bdf8',
    d1Accent: '#0ea5e9',
    d1RingStroke: '#38bdf8',
    d2HeroBg: '#081426',
    d2LowerBg: '#0f2038',
    d2Accent: '#f59e0b',
    d2NameColor: '#ffffff',
    d2TeamColor: '#93c5fd',
    d2BarcodeFg: '#ffffff',
    d2BarcodeBg: '#0f2038',
    d3ObsidianBg: '#060c18',
    d3Accent: '#dc2626',
    d3RoleHighlight: '#f87171',
  },
  hackathon: {
    d1HeaderBg: '#ffffff',
    d1LowerBg: '#091128',
    d1HeaderTextColor: '#0f172a',
    d1BadgeColor: '#64748b',
    d1Accent: '#2563eb',
    d1RingStroke: '#ffffff',
    d2HeroBg: '#160d38',
    d2LowerBg: '#f8fafc',
    d2Accent: '#8b5cf6',
    d2NameColor: '#0f172a',
    d2TeamColor: '#334155',
    d2BarcodeFg: '#0f172a',
    d2BarcodeBg: '#f8fafc',
    d3ObsidianBg: '#090a10',
    d3Accent: '#2563eb',
    d3RoleHighlight: '#38bdf8',
  },
  robotics: {
    d1HeaderBg: '#0f172a',
    d1LowerBg: '#070c16',
    d1HeaderTextColor: '#ffffff',
    d1BadgeColor: '#38bdf8',
    d1Accent: '#06b6d4',
    d1RingStroke: '#06b6d4',
    d2HeroBg: '#0a101d',
    d2LowerBg: '#0d172a',
    d2Accent: '#06b6d4',
    d2NameColor: '#ffffff',
    d2TeamColor: '#67e8f9',
    d2BarcodeFg: '#ffffff',
    d2BarcodeBg: '#0d172a',
    d3ObsidianBg: '#070b12',
    d3Accent: '#06b6d4',
    d3RoleHighlight: '#22d3ee',
  },
  cultural: {
    d1HeaderBg: '#1c0828',
    d1LowerBg: '#0f0217',
    d1HeaderTextColor: '#ffffff',
    d1BadgeColor: '#fbbf24',
    d1Accent: '#ec4899',
    d1RingStroke: '#fbbf24',
    d2HeroBg: '#1e052d',
    d2LowerBg: '#2a0a3d',
    d2Accent: '#f43f5e',
    d2NameColor: '#ffffff',
    d2TeamColor: '#f9a8d4',
    d2BarcodeFg: '#ffffff',
    d2BarcodeBg: '#2a0a3d',
    d3ObsidianBg: '#12041c',
    d3Accent: '#f43f5e',
    d3RoleHighlight: '#fb7185',
  },
  conference: {
    d1HeaderBg: '#ffffff',
    d1LowerBg: '#0f172a',
    d1HeaderTextColor: '#0f172a',
    d1BadgeColor: '#b45309',
    d1Accent: '#d97706',
    d1RingStroke: '#ffffff',
    d2HeroBg: '#0f172a',
    d2LowerBg: '#f8fafc',
    d2Accent: '#d97706',
    d2NameColor: '#0f172a',
    d2TeamColor: '#334155',
    d2BarcodeFg: '#0f172a',
    d2BarcodeBg: '#f8fafc',
    d3ObsidianBg: '#0a0d14',
    d3Accent: '#d97706',
    d3RoleHighlight: '#f59e0b',
  },
  gaming: {
    d1HeaderBg: '#0a051d',
    d1LowerBg: '#04020e',
    d1HeaderTextColor: '#ffffff',
    d1BadgeColor: '#a855f7',
    d1Accent: '#8b5cf6',
    d1RingStroke: '#06b6d4',
    d2HeroBg: '#080518',
    d2LowerBg: '#120a2e',
    d2Accent: '#06b6d4',
    d2NameColor: '#ffffff',
    d2TeamColor: '#67e8f9',
    d2BarcodeFg: '#ffffff',
    d2BarcodeBg: '#120a2e',
    d3ObsidianBg: '#05020f',
    d3Accent: '#8b5cf6',
    d3RoleHighlight: '#a855f7',
  },
  workshop: {
    d1HeaderBg: '#ffffff',
    d1LowerBg: '#0d1a2d',
    d1HeaderTextColor: '#0f172a',
    d1BadgeColor: '#0284c7',
    d1Accent: '#0284c7',
    d1RingStroke: '#ffffff',
    d2HeroBg: '#0d1a2d',
    d2LowerBg: '#f8fafc',
    d2Accent: '#0ea5e9',
    d2NameColor: '#0f172a',
    d2TeamColor: '#334155',
    d2BarcodeFg: '#0f172a',
    d2BarcodeBg: '#f8fafc',
    d3ObsidianBg: '#090e18',
    d3Accent: '#0ea5e9',
    d3RoleHighlight: '#38bdf8',
  },
  general: {
    d1HeaderBg: '#ffffff',
    d1LowerBg: '#091128',
    d1HeaderTextColor: '#0f172a',
    d1BadgeColor: '#64748b',
    d1Accent: '#3b82f6',
    d1RingStroke: '#ffffff',
    d2HeroBg: '#160d38',
    d2LowerBg: '#f8fafc',
    d2Accent: '#8b5cf6',
    d2NameColor: '#0f172a',
    d2TeamColor: '#334155',
    d2BarcodeFg: '#0f172a',
    d2BarcodeBg: '#f8fafc',
    d3ObsidianBg: '#090a10',
    d3Accent: '#2563eb',
    d3RoleHighlight: '#38bdf8',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAILED VECTOR ART PATHS
// ─────────────────────────────────────────────────────────────────────────────

/** Singer at microphone silhouette */
export const PATH_SINGER_AT_MIC =
  'M 4 22 L 4.8 10 L 3.5 10.5 L 3.2 8.5 L 4.5 7 L 3.8 5.5 C 3.5 4.5 4.5 3.5 5.5 3.5 C 6.5 3.5 7 4.2 6.8 5.2 L 6 6.8 L 6.5 8 C 7 7.5 7.8 7 8.5 7.2 C 9 6 8.5 4.5 9 3 C 9.5 1.5 11.5 1.2 12.8 2 C 14 2.8 14.2 4.5 13.5 5.8 C 12.8 7 11.5 7.5 11 8.5 L 11.5 12 C 12.5 13 14.5 15 15 18 L 15 22 L 12 22 L 11 17 C 10.5 15.5 9.5 14.5 8.5 14 L 7 14 L 6 18 L 5.5 22 Z'

/** Cheering audience crowd silhouette with raised hands across 54mm */
export const PATH_CONCERT_CROWD =
  'M 0 16 L 0 10 C 1 9.5 2 7 2.5 4 L 3.2 4 L 3 7 C 4 6 5 4 5.5 2.5 L 6.2 2.8 L 5.2 7 C 6 6 7 5 7.8 5.5 L 7 8 C 8 7 9.5 7.5 10 9 C 11 8 12 5 12.5 3 L 13.2 3.2 L 12.5 8 C 14 7 15.5 8 16 10 C 17 9 18 6 18.5 4 L 19.2 4.2 L 18.5 8.5 C 19.5 7.5 21 6.5 21.8 4 L 22.5 4.2 C 22.8 5.5 22.5 7 22 8 L 23.5 5 L 24.2 5.5 L 23 8.5 C 24 8 25.5 9 26 11 C 27 9.5 28.5 7 29 4.5 L 29.8 4.8 L 29 8 C 30 7.5 31.5 6 32 3.5 L 32.8 3.8 L 32 8 C 33 7.5 34.5 8 35 10 C 36 9 37.5 6 38 3 L 38.8 3.2 L 38 7.5 C 39 6.5 40.5 4 41 2 L 41.8 2.2 L 41 6 C 42 5.5 43 4.5 43.8 4.8 L 43 8.5 C 44 8 45.5 8.5 46 10 C 47 9 48.5 6 49 4 L 49.8 4.2 L 49 8 C 50 7.5 51.5 5.5 52 3.5 L 52.8 3.8 L 52 9 C 53 9 53.5 10 54 11 L 54 16 Z'

/** Eighth note ♪ */
export const PATH_EIGHTH_NOTE =
  'M 0.5 7 C 0.5 5.8 2 5 3.5 5.2 L 3.5 1.5 C 3.5 1 3.8 0.5 4.5 0.5 C 5.5 0.5 6.5 1.2 7 2.2 C 6.5 2.8 5.5 3 4.7 2.6 L 4.7 6.8 C 4.5 7.9 3.2 8.8 1.8 8.8 C 0.8 8.8 0.5 8 0.5 7 Z'

/** Double beamed sixteenth note ♫ */
export const PATH_BEAMED_NOTE =
  'M 0.5 7.2 C 0.5 6 1.8 5.2 3 5.4 L 3 1.8 L 8 0.6 L 8 5 C 6.8 4.8 5.5 5.6 5.5 6.8 C 5.5 7.8 6.6 8.5 7.8 8.4 C 8.7 8.3 9.2 7.6 9.2 6.5 L 9.2 0 L 2 1.2 L 2 5.8 C 1 5.6 0.5 6.3 0.5 7.2 Z'

/** Pitch Presenter / Shark Tank Presenter at podium silhouette */
export const PATH_PITCH_PRESENTER =
  'M 0 18 L 4 18 L 4 9 L 2.5 9 L 2.5 7 L 6.5 7 L 6.5 9 L 5.5 9 L 5.5 18 L 8 18 L 8 11 C 7.5 10.5 7 9.5 7.2 8.5 C 7.5 7.2 8.5 6.8 9.5 7 C 10.5 7.2 11.2 8.2 11 9.5 C 10.8 10.5 10 11.2 9.5 11.5 L 9.5 13 C 10.5 12 12 10.5 13.5 9.5 L 14.5 10.5 C 13 12 11 14 10 15 L 10 18 L 12 18 L 12 19 L 0 19 Z'

/** Exponential venture growth curve with arrowhead */
export const PATH_GROWTH_CURVE =
  'M 0 16 Q 14 15 24 10 T 36 2 L 34 2 L 36 2 L 36 4 Z'

/** Sprinter / Athlete runner in motion silhouette */
export const PATH_SPORTS_RUNNER =
  'M 2 16 L 4 14 L 3 11 L 5.5 9.5 L 4 7 L 5.5 6 C 5.2 5 5.8 4 6.8 3.8 C 7.8 3.6 8.8 4.2 9 5.2 C 9.2 6.2 8.5 7.2 7.5 7.5 L 7 8.5 L 9.5 9.5 L 12 8 L 13 9.5 L 10 11.5 L 8.5 11 L 7.5 14 L 10.5 15.5 L 12.5 14 L 13.5 15 L 11 17.5 L 7 16 L 5.5 18 L 2 17 Z'

/** Developer at multi-monitor setup silhouette */
export const PATH_DEV_WORKSPACE =
  'M 1 16 L 1 10 L 6 10 L 6 16 L 7 16 L 7 8 L 13 8 L 13 16 L 14 16 L 14 11 L 18 11 L 18 16 L 19 16 L 19 18 L 0 18 Z'

/** Industrial robotic arm silhouette */
export const PATH_ROBOTIC_ARM =
  'M 2 18 L 6 18 L 6 14 L 9 10 L 13 12 L 15 9 L 17 9 L 17 7 L 15 7 L 13 5 L 11 8 L 8 12 L 4 12 L 4 18 Z'

/** Classical / Contemporary dancer in leap silhouette */
export const PATH_DANCER_PERFORMER =
  'M 2 12 C 4 8 6 6 8 5 C 7.5 4 8 2.5 9.2 2 C 10.2 1.5 11.2 2.2 11.5 3.2 C 11.8 4.2 11.2 5.2 10.5 5.8 L 11.5 7 C 13.5 6 16 5 18 4 L 17.5 6 C 15.5 7 13.5 8 12 9.5 L 13 13 C 14.5 15 16.5 17 18 18 L 16 18.5 C 14.5 17 13 15 11.5 13.5 L 9.5 15 L 7 18 L 5.5 17.5 L 7.5 14 C 6 13 4 12.5 2 12 Z'

/** Gamer at battle rig with headset silhouette */
export const PATH_ESPORTS_GAMER =
  'M 1 18 L 2 13 L 5 13 L 5 18 L 6 18 L 7 11 L 6.5 9 C 6 8.5 6 7.5 6.5 6.5 C 7 5.5 8 5 9 5.2 C 10 5 11 5.8 11.2 6.8 C 11.8 7.5 11.5 8.5 11 9 L 10.5 11 L 12 18 L 14 18 L 14 12 L 18 12 L 18 18 Z'

// ─────────────────────────────────────────────────────────────────────────────
// BUILDERS: DRAFT 1 THEMATIC BACKGROUND SCENES
// ─────────────────────────────────────────────────────────────────────────────

export function buildThemeElementsDraft1(category: EventCategory, pal: ThemeColors): Element[] {
  switch (category) {
    case 'music':
      return [
        // Sweeping stage spotlights
        {
          type: 'shape',
          id: 'music-spotlight-left',
          anchor: { x: 0, y: 0, w: 26, h: 44 },
          shape: 'polygon',
          points: '0,0 6,0 26,44 0,44',
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.14,
        },
        {
          type: 'shape',
          id: 'music-spotlight-right',
          anchor: { x: 28, y: 0, w: 26, h: 44 },
          shape: 'polygon',
          points: '20,0 26,0 26,44 0,44',
          fill: '#8b5cf6',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.14,
        },
        // Singer at microphone silhouette (stage watermark)
        {
          type: 'shape',
          id: 'music-singer-silhouette',
          anchor: { x: 1, y: 16, w: 16, h: 22 },
          shape: 'path',
          d: PATH_SINGER_AT_MIC,
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.32,
        },
        // Floating musical notes
        {
          type: 'shape',
          id: 'music-note-left',
          anchor: { x: 38, y: 16, w: 7, h: 9 },
          shape: 'path',
          d: PATH_EIGHTH_NOTE,
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.45,
        },
        {
          type: 'shape',
          id: 'music-note-right',
          anchor: { x: 44, y: 24, w: 8, h: 9 },
          shape: 'path',
          d: PATH_BEAMED_NOTE,
          fill: '#a855f7',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.45,
        },
        // Concentric acoustic soundwave reverberation ring
        {
          type: 'shape',
          id: 'music-acoustic-ring',
          anchor: { x: 12, y: 22, w: 30, h: 30 },
          shape: 'circle',
          fill: 'transparent',
          stroke: pal.d1Accent,
          strokeWidth: 0.5,
          cornerRadius: 15,
          opacity: 0.35,
        },
        // Equalizer waveform bars
        ...[3.2, 5.5, 8.4, 11.2, 6.5, 9.8, 13.5, 8.2, 12.0, 7.5, 10.2, 5.0, 8.8, 11.5, 6.2, 3.8].map((h, i) => ({
          type: 'shape' as const,
          id: `music-eq-bar-${i}`,
          anchor: { x: 3.5 + i * 3.0, y: 83 - h, w: 1.8, h },
          shape: 'rect' as const,
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0.8,
          opacity: 0.28,
        })),
        // Cheering audience crowd silhouette along bottom
        {
          type: 'shape',
          id: 'music-crowd-silhouette',
          anchor: { x: 0, y: 69.6, w: 54, h: 16 },
          shape: 'path',
          d: PATH_CONCERT_CROWD,
          fill: '#0f021f',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.5,
        },
      ]

    case 'business':
      return [
        // Executive beam
        {
          type: 'shape',
          id: 'biz-spotlight-beam',
          anchor: { x: 0, y: 0, w: 30, h: 42 },
          shape: 'polygon',
          points: '0,0 8,0 30,42 0,42',
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.12,
        },
        // Pitch Presenter at podium silhouette
        {
          type: 'shape',
          id: 'biz-presenter-silhouette',
          anchor: { x: 2, y: 18, w: 14, h: 19 },
          shape: 'path',
          d: PATH_PITCH_PRESENTER,
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.35,
        },
        // Venture growth trajectory curve
        {
          type: 'shape',
          id: 'biz-growth-curve',
          anchor: { x: 14, y: 64, w: 38, h: 18 },
          shape: 'path',
          d: PATH_GROWTH_CURVE,
          fill: 'transparent',
          stroke: pal.d1Accent,
          strokeWidth: 0.85,
          cornerRadius: 0,
          opacity: 0.5,
        },
        // Growth chart vertical bars
        ...[3, 6, 9, 13, 17, 21].map((h, i) => ({
          type: 'shape' as const,
          id: `biz-chart-bar-${i}`,
          anchor: { x: 20 + i * 5.0, y: 82 - h, w: 2.2, h },
          shape: 'rect' as const,
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0.6,
          opacity: 0.22,
        })),
        // Investor audience silhouette
        {
          type: 'shape',
          id: 'biz-crowd-silhouette',
          anchor: { x: 0, y: 72, w: 54, h: 13.6 },
          shape: 'path',
          d: PATH_CONCERT_CROWD,
          fill: '#060a14',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.45,
        },
      ]

    case 'sports':
      return [
        // Stadium floodlight beams
        {
          type: 'shape',
          id: 'sports-light-1',
          anchor: { x: 0, y: 0, w: 28, h: 42 },
          shape: 'polygon',
          points: '0,0 8,0 28,42 0,42',
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.14,
        },
        {
          type: 'shape',
          id: 'sports-light-2',
          anchor: { x: 26, y: 0, w: 28, h: 42 },
          shape: 'polygon',
          points: '20,0 28,0 28,42 0,42',
          fill: '#38bdf8',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.14,
        },
        // Athletic runner silhouette
        {
          type: 'shape',
          id: 'sports-runner-silhouette',
          anchor: { x: 2, y: 18, w: 16, h: 20 },
          shape: 'path',
          d: PATH_SPORTS_RUNNER,
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.35,
        },
        // Athletic speed lines across background
        ...[1, 2, 3].map(i => ({
          type: 'shape' as const,
          id: `sports-speed-line-${i}`,
          anchor: { x: 4, y: 64 + i * 4, w: 46, h: 0.4 },
          shape: 'line' as const,
          fill: 'transparent',
          stroke: pal.d1Accent,
          strokeWidth: 0.4,
          cornerRadius: 0,
          opacity: 0.35,
        })),
        // Stadium spectator crowd silhouette
        {
          type: 'shape',
          id: 'sports-crowd-silhouette',
          anchor: { x: 0, y: 70, w: 54, h: 15.6 },
          shape: 'path',
          d: PATH_CONCERT_CROWD,
          fill: '#050c18',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.45,
        },
      ]

    case 'hackathon':
      return [
        // Cyber matrix code cascades
        ...[8, 14, 20, 26, 32, 38, 44].map((x, i) => ({
          type: 'shape' as const,
          id: `hack-code-line-${i}`,
          anchor: { x, y: 64, w: 0.5, h: 18 },
          shape: 'line' as const,
          fill: 'transparent',
          stroke: pal.d1Accent,
          strokeWidth: 0.35,
          cornerRadius: 0,
          opacity: 0.3,
        })),
        // Developer silhouette
        {
          type: 'shape',
          id: 'hack-dev-silhouette',
          anchor: { x: 2, y: 18, w: 18, h: 18 },
          shape: 'path',
          d: PATH_DEV_WORKSPACE,
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.28,
        },
        // Terminal bracket watermark
        {
          type: 'shape',
          id: 'hack-wireframe',
          anchor: { x: 0, y: 64, w: 54, h: 21 },
          shape: 'polygon',
          points: '0,21 12,0 24,21 36,0 48,21 54,10',
          fill: 'transparent',
          stroke: pal.d1Accent,
          strokeWidth: 0.35,
          cornerRadius: 0,
          opacity: 0.22,
        },
      ]

    case 'robotics':
      return [
        // Robotic arm silhouette
        {
          type: 'shape',
          id: 'robo-arm-silhouette',
          anchor: { x: 2, y: 18, w: 18, h: 18 },
          shape: 'path',
          d: PATH_ROBOTIC_ARM,
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.32,
        },
        // Precision caliper brackets
        {
          type: 'shape',
          id: 'robo-caliper-1',
          anchor: { x: 38, y: 16, w: 8, h: 10 },
          shape: 'polygon',
          points: '0,0 8,0 8,1.5 2,1.5 2,8.5 8,8.5 8,10 0,10',
          fill: 'transparent',
          stroke: pal.d1Accent,
          strokeWidth: 0.45,
          cornerRadius: 0,
          opacity: 0.5,
        },
        // Gear circles
        {
          type: 'shape',
          id: 'robo-gear-ring',
          anchor: { x: 12, y: 66, w: 16, h: 16 },
          shape: 'circle',
          fill: 'transparent',
          stroke: pal.d1Accent,
          strokeWidth: 0.4,
          cornerRadius: 8,
          opacity: 0.3,
        },
      ]

    case 'cultural':
      return [
        // Theatre drapery arcs
        {
          type: 'shape',
          id: 'cultural-swag-left',
          anchor: { x: 0, y: 0, w: 22, h: 18 },
          shape: 'polygon',
          points: '0,0 22,0 12,18 0,14',
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.16,
        },
        {
          type: 'shape',
          id: 'cultural-swag-right',
          anchor: { x: 32, y: 0, w: 22, h: 18 },
          shape: 'polygon',
          points: '0,0 22,0 22,14 10,18',
          fill: '#fbbf24',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.16,
        },
        // Dancer in leap silhouette
        {
          type: 'shape',
          id: 'cultural-dancer-silhouette',
          anchor: { x: 2, y: 18, w: 18, h: 20 },
          shape: 'path',
          d: PATH_DANCER_PERFORMER,
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.32,
        },
        // Festive crowd audience silhouette
        {
          type: 'shape',
          id: 'cultural-crowd-silhouette',
          anchor: { x: 0, y: 70, w: 54, h: 15.6 },
          shape: 'path',
          d: PATH_CONCERT_CROWD,
          fill: '#15031f',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.45,
        },
      ]

    case 'gaming':
      return [
        // Gamer silhouette
        {
          type: 'shape',
          id: 'gaming-gamer-silhouette',
          anchor: { x: 2, y: 18, w: 18, h: 18 },
          shape: 'path',
          d: PATH_ESPORTS_GAMER,
          fill: pal.d1Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.32,
        },
        // Laser rays
        {
          type: 'shape',
          id: 'gaming-laser-1',
          anchor: { x: 0, y: 0, w: 54, h: 36 },
          shape: 'line',
          fill: 'transparent',
          stroke: pal.d1Accent,
          strokeWidth: 0.45,
          cornerRadius: 0,
          opacity: 0.4,
        },
        {
          type: 'shape',
          id: 'gaming-laser-2',
          anchor: { x: 0, y: 36, w: 54, h: 36 },
          shape: 'line',
          fill: 'transparent',
          stroke: '#06b6d4',
          strokeWidth: 0.45,
          cornerRadius: 0,
          opacity: 0.4,
        },
        // Cheering gaming arena crowd
        {
          type: 'shape',
          id: 'gaming-crowd-silhouette',
          anchor: { x: 0, y: 70, w: 54, h: 15.6 },
          shape: 'path',
          d: PATH_CONCERT_CROWD,
          fill: '#080315',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.5,
        },
      ]

    default:
      return [
        // Universal clean modern motif
        {
          type: 'shape',
          id: 'bg-wireframe',
          anchor: { x: 0, y: 64, w: 54, h: 21 },
          shape: 'polygon',
          points: '0,21 12,0 24,21 36,0 48,21 54,10',
          fill: 'transparent',
          stroke: pal.d1Accent,
          strokeWidth: 0.35,
          cornerRadius: 0,
          opacity: 0.22,
        },
      ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDERS: DRAFT 2 THEMATIC BACKGROUND SCENES
// ─────────────────────────────────────────────────────────────────────────────

export function buildThemeElementsDraft2(category: EventCategory, pal: ThemeColors): Element[] {
  switch (category) {
    case 'music':
      return [
        // Stage crossing lasers
        {
          type: 'shape',
          id: 'music-laser-1',
          anchor: { x: 0, y: 5, w: 54, h: 36 },
          shape: 'line',
          fill: 'transparent',
          stroke: '#ec4899',
          strokeWidth: 0.45,
          cornerRadius: 0,
          opacity: 0.45,
        },
        {
          type: 'shape',
          id: 'music-laser-2',
          anchor: { x: 0, y: 41, w: 54, h: 36 },
          shape: 'line',
          fill: 'transparent',
          stroke: '#8b5cf6',
          strokeWidth: 0.45,
          cornerRadius: 0,
          opacity: 0.45,
        },
        // Concentric vinyl sound grooves behind avatar
        {
          type: 'shape',
          id: 'music-groove-1',
          anchor: { x: 12, y: 11.5, w: 30, h: 30 },
          shape: 'circle',
          fill: 'transparent',
          stroke: '#ec4899',
          strokeWidth: 0.4,
          cornerRadius: 15,
          opacity: 0.35,
        },
        {
          type: 'shape',
          id: 'music-groove-2',
          anchor: { x: 9, y: 8.5, w: 36, h: 36 },
          shape: 'circle',
          fill: 'transparent',
          stroke: '#a855f7',
          strokeWidth: 0.3,
          cornerRadius: 18,
          opacity: 0.25,
        },
        // Floating musical notes
        {
          type: 'shape',
          id: 'music-note-crest-1',
          anchor: { x: 3, y: 14, w: 8, h: 9 },
          shape: 'path',
          d: PATH_BEAMED_NOTE,
          fill: '#ec4899',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.6,
        },
        {
          type: 'shape',
          id: 'music-note-crest-2',
          anchor: { x: 43, y: 14, w: 7, h: 9 },
          shape: 'path',
          d: PATH_EIGHTH_NOTE,
          fill: '#a855f7',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.6,
        },
        // Sonic equalizer bars
        ...[2.8, 5.0, 7.8, 10.5, 6.0, 9.2, 12.8, 8.0, 11.2, 7.0, 9.5, 4.5, 8.0, 10.8, 5.8, 3.2].map((h, i) => ({
          type: 'shape' as const,
          id: `music-crest-eq-${i}`,
          anchor: { x: 3.5 + i * 3.0, y: 72 - h, w: 1.8, h },
          shape: 'rect' as const,
          fill: '#d946ef',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0.8,
          opacity: 0.22,
        })),
        // Cheering audience crowd in lower zone
        {
          type: 'shape',
          id: 'music-crowd-silhouette-d2',
          anchor: { x: 0, y: 71, w: 54, h: 14.6 },
          shape: 'path',
          d: PATH_CONCERT_CROWD,
          fill: '#090117',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.4,
        },
      ]

    case 'business':
      return [
        // Executive summit rays
        {
          type: 'shape',
          id: 'biz-laser-1',
          anchor: { x: 0, y: 5, w: 54, h: 36 },
          shape: 'line',
          fill: 'transparent',
          stroke: pal.d2Accent,
          strokeWidth: 0.45,
          cornerRadius: 0,
          opacity: 0.4,
        },
        // Pitch presenter watermark
        {
          type: 'shape',
          id: 'biz-presenter-d2',
          anchor: { x: 3, y: 14, w: 9, h: 12 },
          shape: 'path',
          d: PATH_PITCH_PRESENTER,
          fill: pal.d2Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.45,
        },
        // Halo rings
        {
          type: 'shape',
          id: 'biz-halo-ring-2',
          anchor: { x: 12, y: 11.5, w: 30, h: 30 },
          shape: 'circle',
          fill: 'transparent',
          stroke: pal.d2Accent,
          strokeWidth: 0.4,
          cornerRadius: 15,
          opacity: 0.35,
        },
        // Venture growth curve in lower zone
        {
          type: 'shape',
          id: 'biz-growth-curve-d2',
          anchor: { x: 6, y: 68, w: 42, h: 14 },
          shape: 'path',
          d: PATH_GROWTH_CURVE,
          fill: 'transparent',
          stroke: pal.d2Accent,
          strokeWidth: 0.75,
          cornerRadius: 0,
          opacity: 0.4,
        },
      ]

    case 'sports':
      return [
        // Athletic speed chevrons
        {
          type: 'shape',
          id: 'sports-chevron-1',
          anchor: { x: 3, y: 15, w: 9, h: 9 },
          shape: 'polygon',
          points: '0,0 6,0 9,4.5 6,9 0,9 3,4.5',
          fill: 'transparent',
          stroke: pal.d2Accent,
          strokeWidth: 0.6,
          cornerRadius: 0,
          opacity: 0.5,
        },
        {
          type: 'shape',
          id: 'sports-chevron-2',
          anchor: { x: 42, y: 15, w: 9, h: 9 },
          shape: 'polygon',
          points: '3,0 9,0 6,4.5 9,9 3,9 0,4.5',
          fill: 'transparent',
          stroke: pal.d2Accent,
          strokeWidth: 0.6,
          cornerRadius: 0,
          opacity: 0.5,
        },
        // Athletic runner watermark
        {
          type: 'shape',
          id: 'sports-runner-d2',
          anchor: { x: 19, y: 2, w: 16, h: 12 },
          shape: 'path',
          d: PATH_SPORTS_RUNNER,
          fill: pal.d2Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.3,
        },
        // Cheering stadium crowd
        {
          type: 'shape',
          id: 'sports-crowd-d2',
          anchor: { x: 0, y: 72, w: 54, h: 13.6 },
          shape: 'path',
          d: PATH_CONCERT_CROWD,
          fill: '#081426',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.35,
        },
      ]

    case 'cultural':
      return [
        // Festive star diamonds
        {
          type: 'shape',
          id: 'festive-star-1',
          anchor: { x: 3, y: 14, w: 8, h: 8 },
          shape: 'polygon',
          points: '4,0 5.2,2.8 8,4 5.2,5.2 4,8 2.8,5.2 0,4 2.8,2.8',
          fill: pal.d2Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.5,
        },
        {
          type: 'shape',
          id: 'festive-star-2',
          anchor: { x: 43, y: 14, w: 8, h: 8 },
          shape: 'polygon',
          points: '4,0 5.2,2.8 8,4 5.2,5.2 4,8 2.8,5.2 0,4 2.8,2.8',
          fill: pal.d2Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.5,
        },
        // Dancer watermark
        {
          type: 'shape',
          id: 'cultural-dancer-d2',
          anchor: { x: 2, y: 12, w: 14, h: 16 },
          shape: 'path',
          d: PATH_DANCER_PERFORMER,
          fill: pal.d2Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.35,
        },
      ]

    case 'gaming':
      return [
        // Cyber laser grid
        {
          type: 'shape',
          id: 'gaming-laser-1',
          anchor: { x: 0, y: 5, w: 54, h: 36 },
          shape: 'line',
          fill: 'transparent',
          stroke: pal.d2Accent,
          strokeWidth: 0.45,
          cornerRadius: 0,
          opacity: 0.5,
        },
        // Gamer watermark
        {
          type: 'shape',
          id: 'gaming-gamer-d2',
          anchor: { x: 2, y: 14, w: 12, h: 14 },
          shape: 'path',
          d: PATH_ESPORTS_GAMER,
          fill: pal.d2Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.35,
        },
      ]

    default:
      return [
        // Molecular network clusters
        {
          type: 'shape',
          id: 'hex-cluster-1',
          anchor: { x: 2, y: 13, w: 9, h: 9 },
          shape: 'polygon',
          points: '4.5,0 9,2.6 9,7.8 4.5,10.4 0,7.8 0,2.6',
          fill: 'transparent',
          stroke: pal.d2Accent,
          strokeWidth: 0.45,
          cornerRadius: 0,
          opacity: 0.38,
        },
        {
          type: 'shape',
          id: 'hex-cluster-3',
          anchor: { x: 42, y: 14, w: 8, h: 8 },
          shape: 'polygon',
          points: '4,0 8,2.3 8,6.9 4,9.2 0,6.9 0,2.3',
          fill: 'transparent',
          stroke: pal.d2Accent,
          strokeWidth: 0.4,
          cornerRadius: 0,
          opacity: 0.4,
        },
      ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDERS: DRAFT 3 THEMATIC BACKGROUND SCENES
// ─────────────────────────────────────────────────────────────────────────────

export function buildThemeElementsDraft3(category: EventCategory, pal: ThemeColors): Element[] {
  switch (category) {
    case 'music':
      return [
        // Stage spotlight cone
        {
          type: 'shape',
          id: 'editorial-music-spotlight',
          anchor: { x: 0, y: 0, w: 36, h: 52 },
          shape: 'polygon',
          points: '0,0 12,0 36,52 0,52',
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.14,
        },
        // Large Singer at microphone watermark silhouette
        {
          type: 'shape',
          id: 'editorial-music-singer-watermark',
          anchor: { x: 26, y: 52, w: 22, h: 32 },
          shape: 'path',
          d: PATH_SINGER_AT_MIC,
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.22,
        },
        // Cheering audience crowd silhouette along bottom
        {
          type: 'shape',
          id: 'editorial-music-crowd',
          anchor: { x: 0, y: 71, w: 54, h: 14.6 },
          shape: 'path',
          d: PATH_CONCERT_CROWD,
          fill: '#05010c',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.45,
        },
        // Vertical frequency spectrum equalizer bars
        ...[4.5, 9.2, 14.0, 7.5].map((h, i) => ({
          type: 'shape' as const,
          id: `editorial-freq-bar-${i}`,
          anchor: { x: 31.5 + i * 1.1, y: 49 - h, w: 0.65, h },
          shape: 'rect' as const,
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0.3,
          opacity: 0.45,
        })),
      ]

    case 'business':
      return [
        // Executive beam
        {
          type: 'shape',
          id: 'editorial-biz-spotlight',
          anchor: { x: 0, y: 0, w: 36, h: 52 },
          shape: 'polygon',
          points: '0,0 10,0 36,52 0,52',
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.12,
        },
        // Pitch presenter watermark
        {
          type: 'shape',
          id: 'editorial-biz-presenter-watermark',
          anchor: { x: 26, y: 54, w: 20, h: 28 },
          shape: 'path',
          d: PATH_PITCH_PRESENTER,
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.22,
        },
        // Growth trajectory curve
        {
          type: 'shape',
          id: 'editorial-biz-curve',
          anchor: { x: 6, y: 70, w: 42, h: 14 },
          shape: 'path',
          d: PATH_GROWTH_CURVE,
          fill: 'transparent',
          stroke: pal.d3Accent,
          strokeWidth: 0.75,
          cornerRadius: 0,
          opacity: 0.4,
        },
      ]

    case 'sports':
      return [
        // Stadium floodlight cone
        {
          type: 'shape',
          id: 'editorial-sports-light',
          anchor: { x: 0, y: 0, w: 36, h: 52 },
          shape: 'polygon',
          points: '0,0 12,0 36,52 0,52',
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.14,
        },
        // Athletic runner watermark
        {
          type: 'shape',
          id: 'editorial-sports-runner-watermark',
          anchor: { x: 26, y: 52, w: 22, h: 30 },
          shape: 'path',
          d: PATH_SPORTS_RUNNER,
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.22,
        },
        // Stadium crowd horizon
        {
          type: 'shape',
          id: 'editorial-sports-crowd',
          anchor: { x: 0, y: 72, w: 54, h: 13.6 },
          shape: 'path',
          d: PATH_CONCERT_CROWD,
          fill: '#040810',
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.45,
        },
      ]

    case 'cultural':
      return [
        // Stage lighting cone
        {
          type: 'shape',
          id: 'editorial-cultural-spotlight',
          anchor: { x: 0, y: 0, w: 36, h: 52 },
          shape: 'polygon',
          points: '0,0 12,0 36,52 0,52',
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.14,
        },
        // Dancer performer watermark
        {
          type: 'shape',
          id: 'editorial-cultural-dancer-watermark',
          anchor: { x: 26, y: 54, w: 22, h: 28 },
          shape: 'path',
          d: PATH_DANCER_PERFORMER,
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.22,
        },
      ]

    case 'gaming':
      return [
        // Laser rays
        {
          type: 'shape',
          id: 'editorial-gaming-light',
          anchor: { x: 0, y: 0, w: 36, h: 52 },
          shape: 'polygon',
          points: '0,0 12,0 36,52 0,52',
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.14,
        },
        // Gamer watermark
        {
          type: 'shape',
          id: 'editorial-gaming-gamer-watermark',
          anchor: { x: 26, y: 54, w: 22, h: 28 },
          shape: 'path',
          d: PATH_ESPORTS_GAMER,
          fill: pal.d3Accent,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
          opacity: 0.22,
        },
      ]

    default:
      return []
  }
}
