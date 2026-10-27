import { Utensils } from 'lucide-react'

export function PhotoPlaceholder({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <span className={`photo-placeholder${compact ? ' compact' : ''}`}>
      <span className="photo-placeholder-mark"><Utensils size={compact ? 14 : 19} /></span>
      <span>{compact ? 'Sin foto' : `Sin foto de ${name}`}</span>
    </span>
  )
}
