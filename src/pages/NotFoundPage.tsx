import { ArrowLeft, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <div className="page-container info-page"><div className="info-card"><span className="info-icon"><Utensils size={22} /></span><span className="eyebrow">404 · MESA NO ENCONTRADA</span><h1>Por aquí no hay <em>mesa.</em></h1><p>Puede que el enlace haya cambiado. Volvamos a encontrar un buen lugar.</p><Link className="button button-primary" to="/"><ArrowLeft size={15} /> Volver al inicio</Link></div></div>
}
