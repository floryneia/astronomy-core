/**
 * @magical-chart/astronomy-core
 * Pure astronomical calculations (positions, velocities, coordinates)
 * Zero dependencies on astrological logic
 */

export { AstronomyEngine, createAstronomyEngine } from './engine'
export type { AstronomyProvider } from './providers/AstronomyProvider'
export { AstronomyEngineProvider } from './providers/AstronomyEngineProvider'

export {
  CelestialBody,
  CalculatedPoint,
  type AstronomicalBody,
  type Position,
  type ChartAngles,
  type EquatorialPosition,
  type ApparentDisk,
  ALL_CELESTIAL_BODIES,
  ALL_CALCULATED_POINTS,
  ALL_BODIES,
  BODY_METADATA,
} from './types'
