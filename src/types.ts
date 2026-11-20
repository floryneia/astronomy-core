/**
 * Astronomy Core Types
 * Standardized types for celestial position data
 */

export enum CelestialBody {
  Sun = 'sun',
  Moon = 'moon',
  Mercury = 'mercury',
  Venus = 'venus',
  Mars = 'mars',
  Jupiter = 'jupiter',
  Saturn = 'saturn',
  Uranus = 'uranus',
  Neptune = 'neptune',
  Pluto = 'pluto',
  Chiron = 'chiron',
  Ceres = 'ceres',
  Pallas = 'pallas',
  Juno = 'juno',
  Vesta = 'vesta',
}

export enum CalculatedPoint {
  TrueNorthNode = 'true_north_node',
  TrueSouthNode = 'true_south_node',
  BlackMoonLilith = 'black_moon_lilith',
}

export type AstronomicalBody = CelestialBody | CalculatedPoint

export interface Position {
  body: AstronomicalBody
  longitude: number // 0-360° on ecliptic
  latitude: number | null // -3° to +3°, null if not applicable
  distance: number | null // AU, null for calculated points
  speed: number // °/day (velocity)
  timestamp: Date // UTC
}

export interface ChartAngles {
  ascendant: number  // ecliptic longitude, 0-360°, the rising sign's exact degree
  midheaven: number  // ecliptic longitude, 0-360°, the MC
}

export interface EquatorialPosition {
  body: AstronomicalBody
  rightAscension: number  // degrees, 0-360° (NOT hours — converted for consistency with Position.longitude)
  declination: number     // degrees, -90 to 90
  timestamp: Date
}

/** What a body actually looked like from Earth on a given date — apparent size and phase, not
 *  position. Ported from interactive-tarot/api/birth-chart.js's apparence() (2026-08-17,
 *  "je voudrais qu'on puisse vraiment zoomer... pour voir les vraies images des planètes le jour
 *  de notre naissance") — the honest version of that request: not a photo (doesn't exist), but
 *  distance/phase, the two things that genuinely differ day to day. */
export interface ApparentDisk {
  body: AstronomicalBody
  distanceAU: number | null   // Earth-body distance, AU — null for the Moon (see distanceKm)
  distanceKm: number | null   // Earth-body distance, km — set for the Moon only, where km is the natural unit
  angularSizeArcsec: number   // apparent angular diameter, arcseconds
  phase: number                // illuminated fraction, 0 (new) to 1 (full) — always 1 for the Sun
}

export const ALL_CELESTIAL_BODIES = Object.values(CelestialBody)
export const ALL_CALCULATED_POINTS = Object.values(CalculatedPoint)
export const ALL_BODIES: AstronomicalBody[] = [...ALL_CELESTIAL_BODIES, ...ALL_CALCULATED_POINTS]

// Metadata for each body
export const BODY_METADATA: Record<AstronomicalBody, { name: string; type: 'physical' | 'calculated' }> = {
  [CelestialBody.Sun]: { name: 'Sun', type: 'physical' },
  [CelestialBody.Moon]: { name: 'Moon', type: 'physical' },
  [CelestialBody.Mercury]: { name: 'Mercury', type: 'physical' },
  [CelestialBody.Venus]: { name: 'Venus', type: 'physical' },
  [CelestialBody.Mars]: { name: 'Mars', type: 'physical' },
  [CelestialBody.Jupiter]: { name: 'Jupiter', type: 'physical' },
  [CelestialBody.Saturn]: { name: 'Saturn', type: 'physical' },
  [CelestialBody.Uranus]: { name: 'Uranus', type: 'physical' },
  [CelestialBody.Neptune]: { name: 'Neptune', type: 'physical' },
  [CelestialBody.Pluto]: { name: 'Pluto', type: 'physical' },
  [CelestialBody.Chiron]: { name: 'Chiron', type: 'physical' },
  [CelestialBody.Ceres]: { name: 'Ceres', type: 'physical' },
  [CelestialBody.Pallas]: { name: 'Pallas', type: 'physical' },
  [CelestialBody.Juno]: { name: 'Juno', type: 'physical' },
  [CelestialBody.Vesta]: { name: 'Vesta', type: 'physical' },
  [CalculatedPoint.TrueNorthNode]: { name: 'True North Node', type: 'calculated' },
  [CalculatedPoint.TrueSouthNode]: { name: 'True South Node', type: 'calculated' },
  [CalculatedPoint.BlackMoonLilith]: { name: 'Black Moon Lilith', type: 'calculated' },
}
