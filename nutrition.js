// Harris-Benedict BMR
export function calcBMR({ weight, height, age, sex }) {
  if (sex === 'F') {
    return 10 * weight + 6.25 * height - 5 * age - 161
  }
  return 10 * weight + 6.25 * height - 5 * age + 5
}

export const ACTIVITY_FACTORS = {
  sedentaire: { label: 'Sédentaire', value: 1.2 },
  legere: { label: 'Activité légère', value: 1.375 },
  moderee: { label: 'Activité modérée', value: 1.55 },
  active: { label: 'Active', value: 1.725 },
  tres_active: { label: 'Très active', value: 1.9 },
}

export const GOAL_ADJUSTMENTS = {
  perte: { label: 'Perte de poids', kcal: -400 },
  maintien: { label: 'Maintien', kcal: 0 },
  prise: { label: 'Prise de masse', kcal: 300 },
  reequilibrage: { label: 'Rééquilibrage', kcal: -150 },
}

export function calcNeeds({ weight, height, age, sex, activity, goal }) {
  const bmr = calcBMR({ weight, height, age, sex })
  const actFactor = ACTIVITY_FACTORS[activity]?.value ?? 1.55
  const tdee = bmr * actFactor
  const adjustment = GOAL_ADJUSTMENTS[goal]?.kcal ?? 0
  const target = tdee + adjustment

  // Macros: protéines 1.8g/kg, lipides 30%, glucides le reste
  const proteins = Math.round(weight * 1.8)
  const fats = Math.round((target * 0.30) / 9)
  const carbs = Math.round((target - proteins * 4 - fats * 9) / 4)
  const imc = weight / ((height / 100) ** 2)

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target),
    proteins,
    fats,
    carbs,
    imc: Math.round(imc * 10) / 10,
  }
}

export function calcIMC(weight, height) {
  return Math.round((weight / ((height / 100) ** 2)) * 10) / 10
}

export function imcCategory(imc) {
  if (imc < 18.5) return { label: 'Insuffisance pondérale', color: '#185FA5' }
  if (imc < 25) return { label: 'Poids normal', color: '#3B6D11' }
  if (imc < 30) return { label: 'Surpoids', color: '#854F0B' }
  return { label: 'Obésité', color: '#A32D2D' }
}
