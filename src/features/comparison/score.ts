export type ComparisonValues = {
  rating?: number
  price?: number
  distance?: number
  availability?: number
}

export type ComparisonWeights = Required<ComparisonValues>

export const defaultWeights: ComparisonWeights = {
  rating: 0.4,
  price: 0.25,
  availability: 0.2,
  distance: 0.15,
}

export function weightsWithPriority(
  priority: keyof ComparisonWeights,
  weights: ComparisonWeights = defaultWeights,
  priorityWeight = 0.55,
): ComparisonWeights {
  if (!Number.isFinite(priorityWeight) || priorityWeight < 0 || priorityWeight > 1) {
    throw new RangeError('El peso prioritario debe estar entre 0 y 1.')
  }
  const otherWeightTotal = Object.entries(weights)
    .filter(([criterion]) => criterion !== priority)
    .reduce((total, [, weight]) => total + weight, 0)
  if (otherWeightTotal <= 0 && priorityWeight < 1) {
    throw new RangeError('Los demás criterios deben tener peso para redistribuir la prioridad.')
  }
  return Object.fromEntries(
    Object.entries(weights).map(([criterion, weight]) => [
      criterion,
      criterion === priority
        ? priorityWeight
        : otherWeightTotal === 0 ? 0 : (1 - priorityWeight) * weight / otherWeightTotal,
    ]),
  ) as ComparisonWeights
}

export function calculateScore(
  values: ComparisonValues,
  weights: ComparisonWeights = defaultWeights,
  priceCeiling = 200,
  distanceCeiling = 10,
): number | null {
  const entries = Object.entries(weights) as [keyof ComparisonWeights, number][]
  if (entries.some(([, weight]) => !Number.isFinite(weight) || weight < 0)) {
    throw new RangeError('Los pesos de comparación deben ser números no negativos.')
  }
  const weightTotal = entries.reduce((sum, [, weight]) => sum + weight, 0)
  if (weightTotal <= 0) throw new RangeError('Al menos un criterio debe tener peso.')

  const normalized: ComparisonValues = {
    rating: values.rating === undefined ? undefined : Math.min(1, Math.max(0, values.rating / 5)),
    price: values.price === undefined ? undefined : Math.min(1, Math.max(0, 1 - values.price / priceCeiling)),
    availability: values.availability === undefined ? undefined : Math.min(1, Math.max(0, values.availability)),
    distance: values.distance === undefined ? undefined : Math.min(1, Math.max(0, 1 - values.distance / distanceCeiling)),
  }
  let availableWeight = 0
  let score = 0
  for (const [criterion, weight] of entries) {
    const value = normalized[criterion]
    if (value !== undefined) {
      availableWeight += weight
      score += value * weight
    }
  }
  return availableWeight === 0 ? null : Math.round((score / availableWeight) * 100)
}
