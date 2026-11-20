/**
 * AstronomyEngine
 * Main public interface for astronomical calculations
 * Provider pattern allows swapping data sources
 */

import { AstronomyProvider } from './providers/AstronomyProvider'
import { AstronomicalBody, CelestialBody, Position, ALL_BODIES, ChartAngles, EquatorialPosition, ApparentDisk } from './types'

export class AstronomyEngine {
  constructor(private provider: AstronomyProvider) {}

  /**
   * Get position of a single body
   */
  async getPosition(body: AstronomicalBody, date: Date): Promise<Position> {
    this.validateDate(date)
    return this.provider.getPosition(body, date)
  }

  /**
   * Get positions of multiple bodies (optimized for batch)
   */
  async getPositions(bodies: AstronomicalBody[], date: Date): Promise<Position[]> {
    this.validateDate(date)
    return this.provider.getPositions(bodies, date)
  }

  /**
   * Get all 12 bodies (10 physical + 2 calculated points)
   */
  async getAllBodies(date: Date): Promise<Position[]> {
    this.validateDate(date)
    return this.getPositions(ALL_BODIES, date)
  }

  /**
   * Convenience: Get Sun position
   */
  async getSun(date: Date): Promise<Position> {
    this.validateDate(date)
    return this.getPosition(CelestialBody.Sun, date)
  }

  /**
   * Convenience: Get Moon position
   */
  async getMoon(date: Date): Promise<Position> {
    this.validateDate(date)
    return this.getPosition(CelestialBody.Moon, date)
  }

  /**
   * Ascendant & Midheaven for an exact birth moment and place. Unlike planet positions,
   * these need a location — not just a date — since they describe the local horizon.
   */
  async getAngles(date: Date, latitude: number, longitude: number): Promise<ChartAngles> {
    this.validateDate(date)
    return this.provider.getAngles(date, latitude, longitude)
  }

  /** The 12 Placidus house cusp longitudes. Throws if Placidus is undefined at this
   *  latitude/date (inside the polar circles) — see AstronomyProvider for the full contract. */
  async getPlacidusCusps(date: Date, latitude: number, longitude: number): Promise<number[]> {
    this.validateDate(date)
    return this.provider.getPlacidusCusps(date, latitude, longitude)
  }

  /** Right ascension & declination — what astrocartography lines are built from. */
  async getEquatorial(body: AstronomicalBody, date: Date): Promise<EquatorialPosition> {
    this.validateDate(date)
    return this.provider.getEquatorial(body, date)
  }

  /** Greenwich Apparent Sidereal Time, in degrees [0, 360). */
  async getSiderealTime(date: Date): Promise<number> {
    this.validateDate(date)
    return this.provider.getSiderealTime(date)
  }

  /** Apparent angular size and phase — what the body would have looked like from Earth that day. */
  async getApparentDisk(body: AstronomicalBody, date: Date): Promise<ApparentDisk> {
    this.validateDate(date)
    return this.provider.getApparentDisk(body, date)
  }

  /** Next moment the Sun reaches `targetLongitude` at/after `searchStart` — the solar-return
   *  root-finder (see AstronomyProvider for the full contract). */
  async findSunLongitude(targetLongitude: number, searchStart: Date, limitDays?: number): Promise<Date> {
    this.validateDate(searchStart)
    return this.provider.findSunLongitude(targetLongitude, searchStart, limitDays)
  }

  private validateDate(date: Date): void {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid date provided')
    }
  }
}

/**
 * Factory function to create AstronomyEngine with injected provider
 */
export function createAstronomyEngine(config: { provider: AstronomyProvider }): AstronomyEngine {
  if (!config.provider) {
    throw new Error('AstronomyProvider required in createAstronomyEngine config')
  }
  return new AstronomyEngine(config.provider)
}
