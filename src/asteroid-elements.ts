/**
 * Osculating heliocentric orbital elements for Chiron and the four classical asteroids,
 * referenced to J2000.0 ecliptic, epoch JD 2460310.5 (2024-01-01 00:00 TDB).
 * Source: NASA/JPL Horizons API (SB441-N16 small-body perturbers), GEOMETRIC osculating
 * elements, fetched 2026-11-05.
 *
 * These are NOT astronomy-engine-covered bodies (it ships Sun/Moon/Mercury-Pluto only), so
 * positions are propagated here via simple two-body Keplerian motion from this single epoch —
 * no secular perturbation model. Accuracy degrades with distance from the epoch; see
 * packages/astronomy-validation/__tests__/asteroid-grid.test.ts for the measured error growth
 * (1945-2055). Chiron in particular crosses Saturn's and Uranus's orbits and is measurably less
 * accurate far from epoch than the four main-belt asteroids.
 */

export interface OrbitalElements {
  epochJd: number // JDTDB of the elements
  eccentricity: number
  semiMajorAxisAu: number
  inclinationDeg: number
  ascendingNodeDeg: number
  argPerihelionDeg: number
  meanAnomalyDeg: number
  meanMotionDegPerDay: number
}

export const EPOCH_JD = 2460310.5 // 2024-01-01 00:00 TDB

export const ASTEROID_ELEMENTS: Record<string, OrbitalElements> = {
  ceres: {
    epochJd: EPOCH_JD,
    eccentricity: 0.07898250774570179,
    semiMajorAxisAu: 2.767197170265466,
    inclinationDeg: 10.58735257915500,
    ascendingNodeDeg: 80.25362071211272,
    argPerihelionDeg: 73.39055644280381,
    meanAnomalyDeg: 83.65451740335429,
    meanMotionDegPerDay: 0.2141134338542102,
  },
  pallas: {
    epochJd: EPOCH_JD,
    eccentricity: 0.2303053074255927,
    semiMajorAxisAu: 2.770377099320790,
    inclinationDeg: 34.92387638387389,
    ascendingNodeDeg: 172.9169652106034,
    argPerihelionDeg: 310.8837599840687,
    meanAnomalyDeg: 64.09610504036702,
    meanMotionDegPerDay: 0.2137448901030825,
  },
  juno: {
    epochJd: EPOCH_JD,
    eccentricity: 0.2562051674092646,
    semiMajorAxisAu: 2.669502943387787,
    inclinationDeg: 12.99015942328583,
    ascendingNodeDeg: 169.8403211159851,
    argPerihelionDeg: 247.7600295285438,
    meanAnomalyDeg: 61.86410079977317,
    meanMotionDegPerDay: 0.2259739972088079,
  },
  vesta: {
    epochJd: EPOCH_JD,
    eccentricity: 0.08974783723267052,
    semiMajorAxisAu: 2.361277704323764,
    inclinationDeg: 7.143402706604142,
    ascendingNodeDeg: 103.7051012078538,
    argPerihelionDeg: 151.6708385934564,
    meanAnomalyDeg: 199.2233363086989,
    meanMotionDegPerDay: 0.2716335904956100,
  },
  chiron: {
    epochJd: EPOCH_JD,
    eccentricity: 0.3766375557138321,
    semiMajorAxisAu: 13.71128063966188,
    inclinationDeg: 6.916870587872204,
    ascendingNodeDeg: 209.3077647793359,
    argPerihelionDeg: 339.3203261586348,
    meanAnomalyDeg: 199.1658022613717,
    meanMotionDegPerDay: 0.01941274920661805,
  },
}
