# astronomy-core

Provider-pattern TypeScript library for precise celestial body calculations — planetary positions, Placidus house cusps, astrocartography coordinates, apparent disk data, and more.

Built as the calculation engine inside a production astrology SaaS. Zero astrological logic — pure geometry and ephemeris math.

## Features

- **15+ bodies**: Sun, Moon, Mercury through Pluto, Chiron, Ceres, Pallas, Juno, Vesta, True Lunar Nodes, Black Moon Lilith
- **Placidus house cusps** via fixed-point iteration — validated against Swiss Ephemeris across 556 dates x 5 locations
- **Astrocartography coordinates** (equatorial RA/dec) with correct of-date obliquity (not J2000 — see note below)
- **Black Moon Lilith** via osculating apogee from analytic Moon velocity (not finite-difference — see note below)
- **Asteroid positions** via two-body Kepler propagation from JPL Horizons osculating elements
- **Provider pattern** — swap the ephemeris backend without touching your application code
- Validated against Swiss Ephemeris and NASA/JPL Horizons

## Installation

```bash
npm install astronomy-core
# or
pnpm add astronomy-core
```

## Quick start

```typescript
import { createAstronomyEngine, AstronomyEngineProvider, CelestialBody } from 'astronomy-core'

const engine = createAstronomyEngine({
  provider: new AstronomyEngineProvider(),
})

const sun = await engine.getSun(new Date('2025-07-31T12:00:00Z'))
// {
//   body: 'sun',
//   longitude: 128.45,  // ecliptic degrees, 0-360
//   latitude: -0.00,    // degrees from ecliptic
//   distance: 1.016,    // AU
//   speed: 1.02,        // degrees/day
//   timestamp: Date
// }
```

## API

### Positions

```typescript
// Single body
const mars = await engine.getPosition(CelestialBody.Mars, date)

// Multiple bodies
const positions = await engine.getPositions([CelestialBody.Sun, CelestialBody.Moon], date)

// All 18 bodies at once
const all = await engine.getAllBodies(date)
```

### Chart angles

```typescript
// Ascendant and Midheaven — requires location as well as time
const { ascendant, midheaven } = await engine.getAngles(date, latitude, longitude)
```

### Placidus house cusps

```typescript
// Returns 12 cusp longitudes (ecliptic degrees)
// Throws for polar latitudes where Placidus is undefined — matching Swiss Ephemeris behaviour
const cusps = await engine.getPlacidusCusps(date, latitude, longitude)
```

### Astrocartography (equatorial coordinates)

```typescript
// Right ascension and declination — what astrocartography meridian/horizon lines need
const { rightAscension, declination } = await engine.getEquatorial(CelestialBody.Venus, date)
```

### Apparent disk

```typescript
// Angular size and illuminated phase — what the body looked like from Earth that day
const disk = await engine.getApparentDisk(CelestialBody.Moon, date)
// { distanceKm: 384400, angularSizeArcsec: 1865.3, phase: 0.73 }
```

### Solar longitude search

```typescript
// Find the next moment the Sun reaches a target longitude — used for solar returns,
// equinoxes, solstices, and BaZi solar terms
const springEquinox = await engine.findSunLongitude(0, new Date('2025-01-01T00:00:00Z'))
```

## Provider pattern

The engine is decoupled from any specific ephemeris library via a `AstronomyProvider` interface:

```typescript
export interface AstronomyProvider {
  getPosition(body: AstronomicalBody, date: Date): Promise<Position>
  getPositions(bodies: AstronomicalBody[], date: Date): Promise<Position[]>
  getAngles(date: Date, lat: number, lon: number): Promise<ChartAngles>
  getPlacidusCusps(date: Date, lat: number, lon: number): Promise<number[]>
  getEquatorial(body: AstronomicalBody, date: Date): Promise<EquatorialPosition>
  getSiderealTime(date: Date): Promise<number>
  getApparentDisk(body: AstronomicalBody, date: Date): Promise<ApparentDisk>
  findSunLongitude(target: number, start: Date, limitDays?: number): Promise<Date>
}
```

The included `AstronomyEngineProvider` wraps [astronomy-engine](https://github.com/cosinekitty/astronomy). A Swiss Ephemeris provider, a mock for tests, or a remote API provider can be dropped in without touching any consumer code.

## Implementation notes

### Equatorial coordinates use of-date obliquity, not J2000

`getEquatorial` builds RA/dec by rotating the of-date ecliptic coordinates through the of-date true obliquity. Using `astronomy-engine`'s `GeoVector()` + `EquatorFromVector()` directly would give J2000 mean equatorial coordinates, which are off by the accumulated precession (~50.29"/yr). At 26 years post-J2000 that is 0.36-0.42° of drift against Swiss Ephemeris — enough to shift an astrocartography line by hundreds of kilometres.

### Black Moon Lilith uses analytic velocity, not finite difference

The osculating apogee direction is the eccentricity vector `e = (v x h)/mu - r_hat`. Because `e` is the near-cancellation of two ~unit vectors, it amplifies any velocity error far more than a simple position or angular-momentum direction. A 60-second finite-difference velocity produced errors up to 160° against Swiss Ephemeris. Switching to `astronomy-engine`'s `GeoMoonState()` (analytic velocity) brought the error under 0.1°.

### Placidus undefined at polar latitudes

The Placidus diurnal semi-arc equation `acos(-tan(lat) * tan(dec))` has no solution when `|tan(lat) * tan(dec)| > 1`. The implementation throws in that case rather than returning a wrong cusp, matching Swiss Ephemeris's own behaviour.

## Validation

All implementations are validated against Swiss Ephemeris and/or NASA/JPL Horizons:

| Feature | Validation dataset | Error |
|---|---|---|
| Planetary positions | 556 dates, celestial-bodies-validation.json | <0.01° vs Swiss Ephemeris |
| True Lunar Nodes | 25 dates, lunar-node-validation.json | mean 0.003°, max 0.007° |
| Black Moon Lilith | 556-epoch grid vs swe.OSCU_APOG | <0.1° |
| Placidus cusps | 556 dates x 5 locations vs swe.houses_ex | <0.001° |
| Equatorial coords | spot-checked vs Swiss Ephemeris | <0.01° |

Validation fixtures are in `__tests__/`.

## Running tests

```bash
npm install
npm test
```

## Important: UTC dates required

All dates must be UTC. Pass ISO 8601 strings ending with `Z`:

```typescript
// correct
new Date('2025-07-31T12:00:00Z')

// wrong — interpreted as local time, will give wrong positions
new Date('2025-07-31')
```

## License

MIT
