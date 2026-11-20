/**
 * AstronomyProvider Interface
 * Defines contract for pluggable astronomical data sources
 */

import { AstronomicalBody, Position, ChartAngles, EquatorialPosition, ApparentDisk } from '../types'

export interface AstronomyProvider {
  /**
   * Get position of a single celestial body
   * @param body - The celestial body or calculated point
   * @param date - Date in UTC
   * @returns Position data (longitude, latitude, distance, speed)
   */
  getPosition(body: AstronomicalBody, date: Date): Promise<Position>

  /**
   * Get positions of multiple celestial bodies
   * @param bodies - Array of celestial bodies/points
   * @param date - Date in UTC
   * @returns Array of Position data
   */
  getPositions(bodies: AstronomicalBody[], date: Date): Promise<Position[]>

  /**
   * Get the Ascendant and Midheaven ecliptic longitudes for a birth moment and place.
   * Requires exact time AND location — unlike planet positions, these depend on the
   * observer's position on Earth, not just the moment in time.
   * @param date - Date in UTC
   * @param latitude - Observer's geographic latitude, degrees (-90 to 90)
   * @param longitude - Observer's geographic longitude, degrees, east-positive (-180 to 180)
   */
  getAngles(date: Date, latitude: number, longitude: number): Promise<ChartAngles>

  /**
   * The 12 Placidus house cusp longitudes (index 0 = house 1/Ascendant ... index 9 =
   * house 10/Midheaven ... index 11 = house 12), in ecliptic longitude degrees.
   * Placidus is mathematically undefined inside the polar circles for part of the year
   * (the diurnal/nocturnal semi-arc equation has no solution there) — implementations
   * MUST throw rather than return a wrong cusp in that case, matching Swiss Ephemeris's
   * own refusal.
   */
  getPlacidusCusps(date: Date, latitude: number, longitude: number): Promise<number[]>

  /**
   * Right ascension & declination — the equatorial coordinates astrocartography needs (meridian
   * and horizon lines are naturally equatorial, not ecliptic). Unlike getAngles, this needs no
   * observer location: it's a property of the body at that moment, like getPosition.
   */
  getEquatorial(body: AstronomicalBody, date: Date): Promise<EquatorialPosition>

  /** Greenwich Apparent Sidereal Time, in degrees [0, 360). What astrocartography's meridian
   *  lines are measured against — local sidereal time is this plus the observer's longitude. */
  getSiderealTime(date: Date): Promise<number>

  /** Apparent angular size and illuminated phase of a body on a given date — what it would have
   *  looked like through a telescope that day, not where it was. */
  getApparentDisk(body: AstronomicalBody, date: Date): Promise<ApparentDisk>

  /**
   * Next moment at or after `searchStart` when the Sun's ecliptic longitude equals
   * `targetLongitude` — the root-finder solar returns are built on (search for the Sun back
   * at its natal longitude) and, more generally, any calendar anchored to solar longitude
   * (equinoxes/solstices at 0/90/180/270, BaZi solar terms, etc).
   * @param limitDays - Search window in days; throws if nothing is found within it.
   */
  findSunLongitude(targetLongitude: number, searchStart: Date, limitDays?: number): Promise<Date>
}
