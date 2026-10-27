import { ArrowLeft, Camera, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { photoCredits } from '../features/restaurants/photoCredits'

export function PhotoCreditsPage() {
  return (
    <div className="page-container credits-page">
      <div className="breadcrumb"><Link to="/"><ArrowLeft size={14} /> Inicio</Link><span>/</span><span>Créditos de las fotografías</span></div>
      <div className="credits-intro">
        <span className="eyebrow"><Camera size={13} /> FOTOGRAFÍA REAL, CON ATRIBUCIÓN</span>
        <h1>Créditos de las <em>fotografías.</em></h1>
        <p>
          Las fotos de restaurantes y platos de esta guía provienen de Wikimedia Commons y se usan con
          licencias abiertas. Cada imagen conserva el crédito de su autor. Cuando un local no tiene una
          fotografía propia, mostramos un espacio sin foto en lugar de una imagen referencial.
        </p>
      </div>
      <div className="credits-list">
        {photoCredits.map((credit) => (
          <article className="credit-item" key={credit.file}>
            <div>
              <strong>{credit.file.replace(/\.[^.]+$/, '')}</strong>
              <span>{credit.author}</span>
            </div>
            <span className="credit-license">{credit.license}</span>
            <a className="text-link" href={credit.sourceUrl} target="_blank" rel="noreferrer">
              Ver en Wikimedia Commons <ExternalLink size={13} />
            </a>
          </article>
        ))}
      </div>
      <p className="credits-note">
        Las imágenes se optimizaron a WebP para reducir el peso de la página. Las licencias y los
        enlaces de origen se mantienen intactos. Los datos de restaurantes curados son de demostración;
        las fotografías son reales y pueden no representar el local exacto.
      </p>
      <Link className="text-link" to="/restaurantes"><ArrowLeft size={14} /> Volver a los restaurantes</Link>
    </div>
  )
}
