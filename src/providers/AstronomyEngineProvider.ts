/**
 * Astronomy Engine Provider
 * Wrapper around the astronomy-engine library (v2.x)
 * Reference: https://github.com/cosinekitty/astronomy
 */

import * as Astronomy from 'astronomy-engine'
import { AstronomyProvider } from './AstronomyProvider'
import { AstronomicalBody, CelestialBody, CalculatedPoint, Position, ChartAngles, EquatorialPosition, ApparentDisk } from '../types'
import { ASTEROID_ELEMENTS, EPOCH_JD, OrbitalElements } from '../asteroid-elements'

// UAI equatorial radii, km — same table as api/birth-chart.js's RAYON (ported 2026-08-22).
// Partial: Chiron/Ceres/Pallas/Juno/Vesta have no validated radius here, so getApparentDisk
// explicitly refuses them rather than guessing a size.
const RADIUS_KM: Partial<Record<CelestialBody, number>> = {
  [CelestialBody.Sun]: 696000, [CelestialBody.Moon]: 1737.4, [CelestialBody.Mercury]: 2439.7,
  [CelestialBody.Venus]: 6051.8, [CelestialBody.Mars]: 3389.5, [CelestialBody.Jupiter]: 69911,
  [CelestialBody.Saturn]: 58232, [CelestialBody.Uranus]: 25362, [CelestialBody.Neptune]: 24622,
  [CelestialBody.Pluto]: 1188.3,
}
const AU_KM = 149597870.7

const ASTEROID_KEY_BY_BODY: Partial<Record<CelestialBody, string>> = {
  [CelestialBody.Chiron]: 'chiron',
  [CelestialBody.Ceres]: 'ceres',
  [CelestialBody.Pallas]: 'pallas',
  [CelestialBody.Juno]: 'juno',
  [CelestialBody.Vesta]: 'vesta',
}

const DEG = 180 / Math.PI
const RAD = Math.PI / 180
const norm360 = (x: number) => ((x % 360) + 360) % 360
const signedAngleDelta = (end: number, start: number) => ((end - start + 540) % 360) - 180

export class AstronomyEngineProvider implements AstronomyProvider {
  async getPosition(body: AstronomicalBody, date: Date): Promise<Position> {
    return this.getPositions([body], date).then((positions) => positions[0])
  }

  // Ascendant & Midheaven from local sidereal time + geographic latitude — same formulas
  // already live in interactive-tarot/api/birth-chart.js (production since 2026-08),
  // ported here so the validated engine can eventually replace that separate astronomia-based
  // implementation. GAST and true obliquity come from astronomy-engine itself rather than the
  // hand-rolled gmst()/obliq() birth-chart.js uses, so this is the same math on a more precise
  // (IAU 2000/2006, nutation-corrected) input.
  async getAngles(date: Date, latitude: number, longitude: number): Promise<ChartAngles> {
    if (date.toISOString().slice(-1) !== 'Z') {
      throw new Error('Date must be in UTC (ISO string ending with Z)')
    }
    const time = (Astronomy as any).MakeTime(date)
    const gastDeg = Astronomy.SiderealTime(time) * 15         // GAST, hours → degrees
    const eps = (Astronomy as any).e_tilt(time).tobl * RAD    // true obliquity, degrees → radians
    const ramc = norm360(gastDeg + longitude) * RAD           // local sidereal time, east-positive lon
    const phi = latitude * RAD

    let ascendant = Math.atan2(
      Math.cos(ramc),
      -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))
    ) * DEG
    const midheaven = norm360(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) * DEG)

    // At high latitudes the ecliptic/horizon intersection can cross the meridian's
    // opposite branch. Swiss Ephemeris keeps the Ascendant on the positive zodiacal
    // arc from the MC, swapping to the opposite intersection when necessary. Without
    // this selection the raw atan2 result can be 180° away for part of polar-day/night.
    if (signedAngleDelta(ascendant, midheaven) < 0) ascendant += 180

    return { ascendant: norm360(ascendant), midheaven }
  }

  // Placidus house cusps 11, 12, 2, 3 (cusps 1/4/7/10 are the Ascendant/IC/Descendant/MC from
  // getAngles; cusps 5,6,8,9 are the oppositions of 11,12,2,3). Placidus defines each
  // intermediate cusp by splitting, IN TIME, the diurnal or nocturnal semi-arc BETWEEN the two
  // angles it sits between — using that cusp's OWN declination, which depends on its own
  // longitude, hence the self-referential equation solved by fixed-point iteration below:
  //   SDA(λ) = acos(-tan(lat)·tan(dec(λ)))         (diurnal semi-arc, degrees of hour angle)
  //   house 11: H(λ) = -SDA(λ)/3        house 12: H(λ) = -2·SDA(λ)/3
  //   house 2:  H(λ) = -60 - 2·SDA(λ)/3  house 3:  H(λ) = -120 - SDA(λ)/3
  // where H(λ) = RAMC - RA(λ). Each iteration inverts RA(λ)=target back to λ in closed form
  // (λ = atan2(sin(RA), cos(RA)·cos(ε))) using the PREVIOUS iteration's declination — this
  // converges in a handful of steps because RA/dec vary smoothly with λ.
  // Undefined inside the polar circles (|tan(lat)·tan(dec)| > 1 for some candidate cusp): throws,
  // matching Swiss Ephemeris's own refusal there rather than returning a wrong cusp.
  // Validated against swe.houses_ex(..., b'P') across 556 dates × 5 non-polar locations.
  async getPlacidusCusps(date: Date, latitude: number, longitude: number): Promise<number[]> {
    if (date.toISOString().slice(-1) !== 'Z') {
      throw new Error('Date must be in UTC (ISO string ending with Z)')
    }
    const time = (Astronomy as any).MakeTime(date)
    const gastDeg = Astronomy.SiderealTime(time) * 15
    const eps = (Astronomy as any).e_tilt(time).tobl * RAD
    const ramcDeg = norm360(gastDeg + longitude)
    const phi = latitude * RAD

    const { ascendant, midheaven } = await this.getAngles(date, latitude, longitude)

    const decOf = (lambdaDeg: number) => Math.asin(Math.sin(eps) * Math.sin(lambdaDeg * RAD))
    const sdaOf = (dec: number) => {
      const x = -Math.tan(phi) * Math.tan(dec)
      if (x < -1 || x > 1) {
        throw new Error(
          `Placidus is undefined at latitude ${latitude} on ${date.toISOString()} ` +
          '(diurnal semi-arc has no solution for a candidate cusp inside the polar circle)'
        )
      }
      return Math.acos(x) * DEG
    }
    const longitudeFromRa = (raDeg: number) => norm360(Math.atan2(Math.sin(raDeg * RAD), Math.cos(raDeg * RAD) * Math.cos(eps)) * DEG)

    // targetHourAngle(λ) for each cusp, as a function of that cusp's OWN current-estimate λ
    const solveCusp = (targetHourAngle: (sda: number) => number, initialGuessDeg: number) => {
      let lambdaDeg = initialGuessDeg
      for (let i = 0; i < 30; i++) {
        const sda = sdaOf(decOf(lambdaDeg))
        const raTargetDeg = norm360(ramcDeg - targetHourAngle(sda))
        const nextLambdaDeg = longitudeFromRa(raTargetDeg)
        if (Math.abs(signedAngleDelta(nextLambdaDeg, lambdaDeg)) < 1e-10) {
          lambdaDeg = nextLambdaDeg
          break
        }
        lambdaDeg = nextLambdaDeg
      }
      return lambdaDeg
    }

    const house11 = solveCusp((sda) => -sda / 3, norm360(midheaven + 20))
    const house12 = solveCusp((sda) => (-2 * sda) / 3, norm360(midheaven + 40))
    const house2 = solveCusp((sda) => -60 - (2 * sda) / 3, norm360(ascendant + 40))
    const house3 = solveCusp((sda) => -120 - sda / 3, norm360(ascendant + 20))

    const cusps = new Array(12)
    cusps[0] = ascendant
    cusps[1] = house2
    cusps[2] = house3
    cusps[3] = norm360(midheaven + 180)
    cusps[4] = norm360(house11 + 180)
    cusps[5] = norm360(house12 + 180)
    cusps[6] = norm360(ascendant + 180)
    cusps[7] = norm360(house2 + 180)
    cusps[8] = norm360(house3 + 180)
    cusps[9] = midheaven
    cusps[10] = house11
    cusps[11] = house12
    return cusps
  }

  // Right ascension & declination — astrocartography lines are naturally equatorial. Built by
  // rotating the body's OF-DATE ecliptic longitude/latitude (the same values calculatePosition()
  // already returns, and celestial-bodies-validation.json already confirms match Swiss Ephemeris
  // to <0.01°) through the OF-DATE true obliquity — exactly birth-chart.js's ecliptic→equatorial
  // formula. Using the real ecliptic latitude (not assuming β=0) makes this correct for the Moon
  // too, without a special case: β=0 for the Sun is still exact by definition, it just falls out
  // of the same formula rather than needing its own branch.
  //
  // NOT built from Astronomy.GeoVector()+EquatorFromVector(): that vector is J2000 mean equator
  // (documented in astronomy-engine's own types), and mixing J2000 RA with an of-date sidereal
  // time — which astrocartography's meridian/horizon math needs — silently drifts by the
  // precession accumulated since J2000. Caught here: 0.36-0.42° off at 26 years post-J2000
  // against Swiss Ephemeris, i.e. exactly what ~50.29"/yr adds up to. Left as a lesson, not
  // rewritten as a guess a second time.
  async getEquatorial(body: AstronomicalBody, date: Date): Promise<EquatorialPosition> {
    if (date.toISOString().slice(-1) !== 'Z') {
      throw new Error('Date must be in UTC (ISO string ending with Z)')
    }
    const time = (Astronomy as any).MakeTime(date)
    const eps = (Astronomy as any).e_tilt(time).tobl * RAD

    let lam: number, beta: number
    if (body === CalculatedPoint.TrueNorthNode || body === CalculatedPoint.TrueSouthNode) {
      lam = this.calculateLunarNode(body, date).longitude * RAD
      beta = 0
    } else if (body === CalculatedPoint.BlackMoonLilith) {
      lam = this.calculateLilith(date).longitude * RAD
      beta = 0
    } else if (ASTEROID_KEY_BY_BODY[body as CelestialBody]) {
      const asteroid = this.calculateAsteroid(body as CelestialBody, date)
      lam = asteroid.longitude * RAD
      beta = (asteroid.latitude ?? 0) * RAD
    } else {
      const bodyEnum = this.mapBodyToAstronomyEngine(body as CelestialBody)
      const gv = Astronomy.GeoVector(bodyEnum as any, date, true)
      const ecl = (Astronomy as any).Ecliptic(gv)
      lam = ecl.elon * RAD
      beta = ecl.elat * RAD
    }

    const ra = norm360(Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lam)) * DEG)
    const dec = Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lam)) * DEG
    return { body, rightAscension: ra, declination: dec, timestamp: date }
  }

  async getSiderealTime(date: Date): Promise<number> {
    if (date.toISOString().slice(-1) !== 'Z') {
      throw new Error('Date must be in UTC (ISO string ending with Z)')
    }
    const time = (Astronomy as any).MakeTime(date)
    return norm360(Astronomy.SiderealTime(time) * 15)
  }

  async getPositions(bodies: AstronomicalBody[], date: Date): Promise<Position[]> {
    // Validate date is UTC
    if (date.toISOString().slice(-1) !== 'Z') {
      throw new Error('Date must be in UTC (ISO string ending with Z)')
    }

    const results: Position[] = []

    for (const body of bodies) {
      try {
        const position = this.calculatePosition(body, date)
        results.push(position)
      } catch (error) {
        throw new Error(`Failed to calculate position for ${body}: ${error}`)
      }
    }

    return results
  }

  private calculatePosition(body: AstronomicalBody, date: Date): Position {
    if (body === CalculatedPoint.TrueNorthNode || body === CalculatedPoint.TrueSouthNode) {
      return this.calculateLunarNode(body, date)
    }
    if (body === CalculatedPoint.BlackMoonLilith) {
      return this.calculateLilith(date)
    }
    if (ASTEROID_KEY_BY_BODY[body as CelestialBody]) {
      return this.calculateAsteroid(body as CelestialBody, date)
    }

    const celestialBody = body as CelestialBody
    const bodyEnum = this.mapBodyToAstronomyEngine(celestialBody)

    // Geocentric position vector (equatorial J2000.0)
    const gv = Astronomy.GeoVector(bodyEnum as any, date, true)

    // Convert to ecliptic coordinates via Astronomy.Ecliptic()
    // GeoVector returns equatorial; atan2(y,x) on that vector gives RA, not ecliptic longitude
    const ecl = (Astronomy as any).Ecliptic(gv)

    // Distance from vector magnitude (Ecliptic() has no dist property)
    const dist = Math.sqrt(gv.x * gv.x + gv.y * gv.y + gv.z * gv.z)

    // Ecliptic longitude speed: finite difference over 1 day
    const nextDay = new Date(date.getTime() + 86400000)
    const gv2 = Astronomy.GeoVector(bodyEnum as any, nextDay, true)
    const ecl2 = (Astronomy as any).Ecliptic(gv2)
    // The longitude may wrap at 0°/360° during the day. Keep speed signed and
    // continuous across that boundary instead of returning a false ~360°/day.
    const speed = signedAngleDelta(ecl2.elon, ecl.elon)

    return {
      body: celestialBody,
      longitude: ecl.elon,
      latitude: ecl.elat,
      distance: dist,
      speed,
      timestamp: date,
    }
  }

  private calculateLunarNode(body: CalculatedPoint, date: Date): Position {
    // True Lunar Node = instantaneous intersection of Moon's orbital plane with the ecliptic.
    // Algorithm: compute angular momentum L = r × v from Moon's ecliptic state vectors,
    // then ascending node direction n = K × L where K = (0,0,1) is the ecliptic north pole.
    // Validated against Swiss Ephemeris (swe.TRUE_NODE): mean error 0.003°, max 0.007° over 25 dates (1990-2025).

    try {
      const DT_MS = 60_000 // 1-minute finite difference for velocity

      const getEclVec = (d: Date) => {
        const gv = Astronomy.GeoVector('Moon' as any, (Astronomy as any).MakeTime(d), true)
        return (Astronomy as any).Ecliptic(gv).vec as { x: number; y: number; z: number }
      }

      const northLonAt = (d: Date) => {
        const r = getEclVec(d)
        const r2 = getEclVec(new Date(d.getTime() + DT_MS))

        const vx = r2.x - r.x
        const vy = r2.y - r.y
        const vz = r2.z - r.z

        const Lx = r.y * vz - r.z * vy
        const Ly = r.z * vx - r.x * vz

        return norm360(Math.atan2(Lx, -Ly) * DEG)
      }

      const northLon = northLonAt(date)
      const nextNorthLon = northLonAt(new Date(date.getTime() + 86400000))

      const southLon = (northLon + 180) % 360
      const rawDelta = nextNorthLon - northLon
      const northSpeed = rawDelta > 180 ? rawDelta - 360 : rawDelta < -180 ? rawDelta + 360 : rawDelta

      return {
        body,
        longitude: body === CalculatedPoint.TrueNorthNode ? northLon : southLon,
        latitude: 0,
        distance: null,
        speed: northSpeed,
        timestamp: date,
      }
    } catch (error) {
      throw new Error(`Failed to calculate lunar node: ${error}`)
    }
  }

  private calculateLilith(date: Date): Position {
    // Black Moon Lilith = apogee of the Moon's instantaneous (osculating) geocentric orbit.
    // Algorithm: from the Moon's ecliptic-of-date state vector (position AND analytic velocity,
    // via GeoMoonState — NOT a finite difference, see below), compute specific angular momentum
    // h = r × v and the eccentricity vector e = (v × h)/μ - r̂ (μ = GM_Earth + GM_Moon). e points
    // toward perigee; apogee longitude is the opposite direction, atan2(-e.y, -e.x).
    //
    // Finite-difference velocity (as used for the lunar node) is NOT accurate enough here: e is
    // a small vector (~0.05) built from the near-cancellation of two ~unit-magnitude terms, so it
    // amplifies any velocity error far more than the node's angular-momentum direction does. A
    // 60-second forward difference produced errors up to 160° against Swiss Ephemeris; switching
    // to GeoMoonState's exact analytic velocity brought the error under 0.1°.
    // Validated against Swiss Ephemeris osculating apogee (swe.OSCU_APOG) across the 556-epoch grid.
    try {
      const MU_KM3_S2 = 403503.235 // GM(Earth) + GM(Moon), km^3/s^2
      const DAY_S = 86400

      const apogeeLonAt = (d: Date) => {
        const time = (Astronomy as any).MakeTime(d)
        const state = (Astronomy as any).GeoMoonState(time)
        const rVec = new (Astronomy as any).Vector(state.x, state.y, state.z, time)
        const vVec = new (Astronomy as any).Vector(state.vx, state.vy, state.vz, time)
        const rEcl = (Astronomy as any).Ecliptic(rVec).vec as { x: number; y: number; z: number }
        const vEcl = (Astronomy as any).Ecliptic(vVec).vec as { x: number; y: number; z: number }

        const r = { x: rEcl.x * AU_KM, y: rEcl.y * AU_KM, z: rEcl.z * AU_KM }
        const v = { x: (vEcl.x * AU_KM) / DAY_S, y: (vEcl.y * AU_KM) / DAY_S, z: (vEcl.z * AU_KM) / DAY_S }

        const hx = r.y * v.z - r.z * v.y
        const hy = r.z * v.x - r.x * v.z
        const hz = r.x * v.y - r.y * v.x

        const vxhX = v.y * hz - v.z * hy
        const vxhY = v.z * hx - v.x * hz

        const rMag = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z)
        const ex = vxhX / MU_KM3_S2 - r.x / rMag
        const ey = vxhY / MU_KM3_S2 - r.y / rMag

        return norm360(Math.atan2(-ey, -ex) * DEG)
      }

      const longitude = apogeeLonAt(date)
      const nextLongitude = apogeeLonAt(new Date(date.getTime() + 86400000))
      const rawDelta = nextLongitude - longitude
      const speed = rawDelta > 180 ? rawDelta - 360 : rawDelta < -180 ? rawDelta + 360 : rawDelta

      return {
        body: CalculatedPoint.BlackMoonLilith,
        longitude,
        latitude: 0,
        distance: null,
        speed,
        timestamp: date,
      }
    } catch (error) {
      throw new Error(`Failed to calculate Black Moon Lilith: ${error}`)
    }
  }

  // Chiron and the four classical asteroids aren't in astronomy-engine (Sun/Moon/Mercury-Pluto
  // only), so their heliocentric position is propagated here via simple two-body Kepler motion
  // from a single epoch's osculating elements (packages/astronomy-core/src/asteroid-elements.ts,
  // sourced from JPL Horizons, epoch 2024-01-01). No secular perturbation model: accuracy
  // degrades with distance from that epoch, more so for Chiron (crosses Saturn's and Uranus's
  // orbits) than the main-belt asteroids. Measured error growth is in
  // packages/astronomy-validation/__tests__/asteroid-grid.test.ts.
  private calculateAsteroid(body: CelestialBody, date: Date): Position {
    const key = ASTEROID_KEY_BY_BODY[body]
    if (!key) throw new Error(`${body} is not a supported asteroid`)
    const elements = ASTEROID_ELEMENTS[key]

    try {
      const geocentricEclipticOfDate = (d: Date) => {
        const time = (Astronomy as any).MakeTime(d)
        const helioAsteroidEclJ2000 = this.keplerHeliocentricPosition(elements, time)
        const helioAsteroidVecJ2000 = new (Astronomy as any).Vector(
          helioAsteroidEclJ2000.x, helioAsteroidEclJ2000.y, helioAsteroidEclJ2000.z, time
        )
        const helioAsteroidEqj = (Astronomy as any).RotateVector((Astronomy as any).Rotation_ECL_EQJ(), helioAsteroidVecJ2000)
        const helioEarthEqj = (Astronomy as any).HelioVector('Earth', time)

        const geocentricEqj = new (Astronomy as any).Vector(
          helioAsteroidEqj.x - helioEarthEqj.x,
          helioAsteroidEqj.y - helioEarthEqj.y,
          helioAsteroidEqj.z - helioEarthEqj.z,
          time
        )
        return (Astronomy as any).Ecliptic(geocentricEqj)
      }

      const ecl = geocentricEclipticOfDate(date)
      const ecl2 = geocentricEclipticOfDate(new Date(date.getTime() + 86400000))
      const speed = signedAngleDelta(ecl2.elon, ecl.elon)
      const distance = Math.sqrt(ecl.vec.x * ecl.vec.x + ecl.vec.y * ecl.vec.y + ecl.vec.z * ecl.vec.z)

      return {
        body,
        longitude: norm360(ecl.elon),
        latitude: ecl.elat,
        distance,
        speed,
        timestamp: date,
      }
    } catch (error) {
      throw new Error(`Failed to calculate ${body}: ${error}`)
    }
  }

  // Solves Kepler's equation (M = E - e sin E) by Newton-Raphson, then rotates the perifocal
  // position by argument of perihelion/inclination/ascending node — the standard two-body
  // osculating-elements-to-Cartesian transform. Returns heliocentric position in the J2000
  // ecliptic frame (the frame the source elements are referenced to), in AU.
  private keplerHeliocentricPosition(elements: OrbitalElements, time: { tt: number }): { x: number; y: number; z: number } {
    const jdTt = 2451545.0 + time.tt
    const daysSinceEpoch = jdTt - EPOCH_JD
    const mDeg = norm360(elements.meanAnomalyDeg + elements.meanMotionDegPerDay * daysSinceEpoch)
    const M = mDeg * RAD
    const e = elements.eccentricity

    let E = M
    for (let i = 0; i < 15; i++) {
      const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
      E -= delta
      if (Math.abs(delta) < 1e-13) break
    }

    const a = elements.semiMajorAxisAu
    const xOrb = a * (Math.cos(E) - e)
    const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E)

    const w = elements.argPerihelionDeg * RAD
    const i = elements.inclinationDeg * RAD
    const om = elements.ascendingNodeDeg * RAD
    const cosW = Math.cos(w), sinW = Math.sin(w)
    const cosI = Math.cos(i), sinI = Math.sin(i)
    const cosOm = Math.cos(om), sinOm = Math.sin(om)

    return {
      x: (cosOm * cosW - sinOm * sinW * cosI) * xOrb + (-cosOm * sinW - sinOm * cosW * cosI) * yOrb,
      y: (sinOm * cosW + cosOm * sinW * cosI) * xOrb + (-sinOm * sinW + cosOm * cosW * cosI) * yOrb,
      z: (sinW * sinI) * xOrb + (cosW * sinI) * yOrb,
    }
  }

  // Ported from api/birth-chart.js's apparence() (2026-08-17). That version hand-rolled the
  // Sun-planet-Earth phase triangle and the Moon's elongation formula from astronomia's raw
  // vectors; astronomy-engine already ships Illumination(), a single call that returns geocentric
  // distance AND illuminated fraction for any body (Sun included, where phase is fixed at 1 —
  // the library sets phase_angle to 0 for the Sun "although this has no physical meaning", so the
  // Sun is still special-cased here rather than trusted to fall out of the general formula).
  // No new position math, no new Swiss Ephemeris comparison needed: distance/phase are pure
  // geometry once the position itself is right, and that part is already validated elsewhere in
  // this package — hence the doc's "cosmétique, pas de la géométrie".
  async getApparentDisk(body: AstronomicalBody, date: Date): Promise<ApparentDisk> {
    if (date.toISOString().slice(-1) !== 'Z') {
      throw new Error('Date must be in UTC (ISO string ending with Z)')
    }
    if (body === CalculatedPoint.TrueNorthNode || body === CalculatedPoint.TrueSouthNode || body === CalculatedPoint.BlackMoonLilith) {
      throw new Error('getApparentDisk is not defined for calculated points (no physical body)')
    }
    if (ASTEROID_KEY_BY_BODY[body as CelestialBody]) {
      throw new Error(`getApparentDisk has no validated radius for ${body} yet`)
    }
    const celestialBody = body as CelestialBody
    const bodyEnum = this.mapBodyToAstronomyEngine(celestialBody)
    const info = Astronomy.Illumination(bodyEnum as any, date)
    const radiusKm = RADIUS_KM[celestialBody]
    if (radiusKm === undefined) throw new Error(`No validated radius for ${celestialBody}`)
    const isSun = celestialBody === CelestialBody.Sun
    const isMoon = celestialBody === CelestialBody.Moon
    const distanceKm = isMoon ? info.geo_dist * AU_KM : null
    const distanceAU = isMoon ? null : info.geo_dist
    const angularSizeArcsec = 2 * Math.atan(radiusKm / (info.geo_dist * AU_KM)) * DEG * 3600
    return {
      body,
      distanceAU: distanceAU === null ? null : Math.round(distanceAU * 1000) / 1000,
      distanceKm: distanceKm === null ? null : Math.round(distanceKm),
      angularSizeArcsec: Math.round(angularSizeArcsec * 1000) / 1000,
      phase: isSun ? 1 : Math.round(info.phase_fraction * 1000) / 1000,
    }
  }

  // Same solver as interactive-tarot/lib/astro-engine.js's findSunLongitude() (ported there
  // 2026-08-24 for BaZi's solar terms) — thin wrapper around astronomy-engine's own
  // SearchSunLongitude, which does the actual root-finding.
  async findSunLongitude(targetLongitude: number, searchStart: Date, limitDays = 20): Promise<Date> {
    if (searchStart.toISOString().slice(-1) !== 'Z') {
      throw new Error('Date must be in UTC (ISO string ending with Z)')
    }
    const t = Astronomy.SearchSunLongitude(targetLongitude, searchStart, limitDays)
    if (!t) throw new Error('Sun longitude not found in search window')
    return t.date
  }

  private mapBodyToAstronomyEngine(body: CelestialBody): string {
    const mapping: Record<string, string> = {
      [CelestialBody.Sun]: 'Sun',
      [CelestialBody.Moon]: 'Moon',
      [CelestialBody.Mercury]: 'Mercury',
      [CelestialBody.Venus]: 'Venus',
      [CelestialBody.Mars]: 'Mars',
      [CelestialBody.Jupiter]: 'Jupiter',
      [CelestialBody.Saturn]: 'Saturn',
      [CelestialBody.Uranus]: 'Uranus',
      [CelestialBody.Neptune]: 'Neptune',
      [CelestialBody.Pluto]: 'Pluto',
    }
    return mapping[body] || 'Sun'
  }
}
