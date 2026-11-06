import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, MapPin, Menu, Utensils, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { publicAsset } from '../lib/publicAsset'
import './MarketingLandingPage.css'

const steps = [
  {
    number: '01',
    title: 'Descubre lo que queda cerca',
    description: 'Explora locales registrados en el mapa y empieza por los que tienes a tu alrededor.',
    image: '/images/discover-all.webp',
    alt: 'Selección de restaurantes para descubrir',
  },
  {
    number: '02',
    title: 'Compara antes de elegir',
    description: 'Revisa cartas, precios por plato y opiniones para encontrar lo que encaja con tu plan.',
    image: '/images/dishes/cebiche-clasico.webp',
    alt: 'Plato de cebiche servido en una mesa',
  },
  {
    number: '03',
    title: 'Elige tu próxima mesa',
    description: 'Consulta los detalles del restaurante y envía una solicitud de reserva.',
    image: '/images/restaurants/punto-azul/cover.webp',
    alt: 'Fotografía de un plato de Punto Azul',
  },
]

const phoneSlides = [
  {
    id: 'punto-azul',
    name: 'Punto Azul',
    cuisine: 'Marina',
    neighborhood: 'Miraflores',
    image: '/images/restaurants/punto-azul/cover.webp',
    alt: 'Fotografía de Punto Azul',
  },
  {
    id: 'la-mar',
    name: 'La Mar Cebichería',
    cuisine: 'Marina',
    neighborhood: 'Miraflores',
    image: '/images/restaurants/la-mar/cover.webp',
    alt: 'Fotografía de La Mar Cebichería',
  },
  {
    id: 'isolina',
    name: 'Isolina',
    cuisine: 'Criolla',
    neighborhood: 'Barranco',
    image: '/images/restaurants/isolina/cover.webp',
    alt: 'Fotografía de Isolina',
  },
]

export function MarketingLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const [activePhoneSlide, setActivePhoneSlide] = useState(0)
  const pageRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const page = pageRef.current
    if (!page) return

    const allowMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const layers = allowMotion ? [...page.querySelectorAll<HTMLElement>('[data-parallax]')].map((element) => ({
      element,
      speed: Number(element.dataset.parallax),
    })) : []
    let previousScrollY = window.scrollY
    let frame = 0

    function updateNavigation() {
      const scrollY = window.scrollY
      if (scrollY < 96) {
        setNavHidden(false)
      } else if (scrollY > previousScrollY + 1) {
        setNavHidden(true)
      } else if (scrollY < previousScrollY - 1) {
        setNavHidden(false)
      }
      previousScrollY = scrollY
    }

    function updateParallax() {
      if (!allowMotion || frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        for (const layer of layers) {
          const bounds = layer.element.getBoundingClientRect()
          const offset = (window.innerHeight / 2 - (bounds.top + bounds.height / 2)) * layer.speed
          layer.element.style.setProperty('--parallax-y', `${Math.round(offset)}px`)
        }
      })
    }

    const revealTargets = [...page.querySelectorAll<HTMLElement>('.landing-step, .landing-plans-visual, .landing-plan-option')]
    let observer: IntersectionObserver | null = null
    if (allowMotion && 'IntersectionObserver' in window) {
      page.classList.add('landing-motion-ready')
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-visible')
          observer?.unobserve(entry.target)
        }
      }, { threshold: 0.16 })
      revealTargets.forEach((element) => observer?.observe(element))
    }

    const handleScroll = () => {
      updateNavigation()
      updateParallax()
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', updateParallax)
    handleScroll()
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      page.classList.remove('landing-motion-ready')
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateParallax)
    }
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const interval = window.setInterval(() => {
      setActivePhoneSlide((current) => (current + 1) % phoneSlides.length)
    }, 4200)
    return () => window.clearInterval(interval)
  }, [])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <main className="marketing-landing" ref={pageRef}>
      <header className={`landing-header${navHidden ? ' is-hidden' : ''}${menuOpen ? ' menu-is-open' : ''}`}>
        <Link className="landing-brand" to="/inicio" aria-label="GastroRed, entrar a la guía">
          <span className="landing-brand-mark"><Utensils size={18} /></span>
          <span>GastroRed<small>BUENOS MOMENTOS, BUENA MESA</small></span>
        </Link>
        <button
          className="landing-menu-button"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="landing-nav"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={`landing-nav${menuOpen ? ' is-open' : ''}`} id="landing-nav" aria-label="Navegación de GastroRed">
          <a href="#como-funciona" onClick={closeMenu}>Cómo funciona</a>
          <a href="#planes" onClick={closeMenu}>Planes</a>
          <Link to="/restaurantes" onClick={closeMenu}>Restaurantes</Link>
          <Link className="landing-nav-cta" to="/inicio" onClick={closeMenu}>Entrar a GastroRed <ArrowUpRight size={15} /></Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><span /> BUENOS MOMENTOS, BUENA MESA</span>
          <h1 id="landing-title" aria-label="Tu próximo lugar favorito está cerca">Tu próximo<br />lugar favorito<br />está <em>cerca.</em></h1>
          <p>Encuentra restaurantes alrededor de ti, compara lo que importa y elige con ganas.</p>
          <div className="landing-actions">
            <Link className="landing-button landing-button-primary" to="/restaurantes">Descubrir restaurantes <ArrowRight size={17} /></Link>
            <a className="landing-text-link" href="#como-funciona">Así funciona <ArrowDown size={15} /></a>
          </div>
          <span className="landing-data-note"><MapPin size={14} /> OpenStreetMap · precios y reseñas demo identificados</span>
        </div>

        <div className="landing-hero-art" aria-label="Vista ilustrativa de la experiencia GastroRed">
          <div className="landing-map" role="img" aria-label="Mapa ilustrativo con un radio cercano de 200 metros">
            <svg className="landing-streets" viewBox="0 0 680 550" aria-hidden="true">
              <path d="M-30 128 700 20M-25 256 692 336M-20 441 690 389M102-20 224 570M340-18 300 560M530-40 460 570" />
              <path d="m23 66 92 38-42 62-89-30m426-71 117 26-35 77-122-28m-298 211 116 38-37 75-116-34m320-87 137 31-31 80-133-34" />
            </svg>
            <div className="landing-map-park" />
            <div className="landing-map-radius" data-parallax="0.07" />
            <div className="landing-map-center"><MapPin size={16} /></div>
            <div className="landing-map-pin pin-one"><MapPin size={16} /></div>
            <div className="landing-map-pin pin-two"><MapPin size={16} /></div>
            <span className="landing-map-label">VISTA ILUSTRATIVA · 200 M</span>
            <div className="landing-place-chip chip-one" data-parallax="0.04"><span className="chip-dot" /> Restaurantes cerca</div>
            <div className="landing-place-chip chip-two" data-parallax="0.08"><span className="chip-dot" /> Explora tu zona</div>
          </div>

          <div className="landing-phone-float" data-parallax="-0.035">
            <article className="landing-phone" aria-label="Ejemplo ilustrativo de ficha de restaurante">
              <div className="landing-phone-top"><span>9:41</span><span className="phone-camera" /><span>●●●</span></div>
              <div className="landing-phone-brand"><span className="landing-brand-mark"><Utensils size={12} /></span> GastroRed <span>•••</span></div>
              <img key={phoneSlides[activePhoneSlide].image} src={publicAsset(phoneSlides[activePhoneSlide].image)} alt={phoneSlides[activePhoneSlide].alt} />
              <div className="landing-phone-content" key={phoneSlides[activePhoneSlide].id}>
                <span className="phone-kicker">FICHA DE EJEMPLO</span>
                <strong>{phoneSlides[activePhoneSlide].name}</strong>
                <span>{phoneSlides[activePhoneSlide].cuisine} · {phoneSlides[activePhoneSlide].neighborhood}</span>
                <div className="phone-info"><MapPin size={12} /> Consulta locales en el mapa</div>
                <Link to={`/restaurantes/${phoneSlides[activePhoneSlide].id}`} className="phone-link">Ver restaurante <ArrowRight size={12} /></Link>
              </div>
              <div className="landing-phone-dots" role="group" aria-label="Restaurantes de ejemplo">
                {phoneSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    className={index === activePhoneSlide ? 'is-active' : ''}
                    type="button"
                    aria-label={`Mostrar ${slide.name}`}
                    aria-pressed={index === activePhoneSlide}
                    onClick={() => setActivePhoneSlide(index)}
                  />
                ))}
              </div>
            </article>
          </div>
          <span className="landing-hero-caption">Descubrimiento a tu ritmo, desde el mapa hasta la mesa.</span>
        </div>

        <div className="landing-plan-strip">
          <span><strong>Free</strong> · descubre a 200 m</span>
          <span><strong>Pro</strong> · S/ 100 al mes <i>Próximamente</i></span>
          <span>La cobertura depende de los datos disponibles en el mapa.</span>
        </div>
      </section>

      <section className="landing-how" id="como-funciona" aria-labelledby="how-title">
        <div className="landing-section-intro">
          <span className="landing-eyebrow"><span /> DESCUBRIR · COMPARAR · ELEGIR</span>
          <h2 id="how-title">Un buen plan<br />empieza <em>cerca.</em></h2>
          <p>Todo lo que necesitas para pasar del antojo a una decisión con más contexto.</p>
          <Link className="landing-text-link" to="/restaurantes">Explora la guía <ArrowUpRight size={15} /></Link>
        </div>
        <div className="landing-steps">
          {steps.map((step) => (
            <article className="landing-step" key={step.number}>
              <div className="landing-step-image">
                <img src={publicAsset(step.image)} alt={step.alt} loading="lazy" />
                <span>{step.number}</span>
              </div>
              <div className="landing-step-copy">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-plans" id="planes" aria-labelledby="plans-title">
        <div className="landing-plans-copy">
          <span className="landing-eyebrow"><span /> MÁS CERCA O MÁS LEJOS</span>
          <h2 id="plans-title">Tu búsqueda,<br />a tu <em>medida.</em></h2>
          <p>Empieza explorando a tu alrededor. Estamos preparando una opción para ampliar el radio y descubrir más lugares.</p>
          <Link className="landing-button landing-button-light" to="/restaurantes">Explorar restaurantes <ArrowRight size={16} /></Link>
        </div>
        <div className="landing-plans-visual" aria-label="Comparación ilustrativa de radios de búsqueda">
          <div className="plan-orbit orbit-outer" data-parallax="0.045"><span>1 km</span></div>
          <div className="plan-orbit orbit-middle" data-parallax="-0.035"><span>500 m</span></div>
          <div className="plan-orbit orbit-inner" data-parallax="0.07"><span>200 m</span></div>
          <div className="plan-orbit-center"><MapPin size={21} /><span>Tu zona</span></div>
          <div className="plan-caption"><span>EL RADIO SE AMPLÍA</span><span>Free ahora · Pro próximamente</span></div>
        </div>
        <div className="landing-plan-options">
          <article className="landing-plan-option">
            <div className="landing-plan-card-heading"><span className="plan-name">GastroRed Free</span><span className="plan-status">Gratis</span></div>
            <strong><span>Sin costo</span></strong>
            <p>Descubrimiento de restaurantes hasta 200 m a la redonda.</p>
            <Link to="/restaurantes">Ver restaurantes <ArrowRight size={14} /></Link>
          </article>
          <article className="landing-plan-option pro-option">
            <div className="landing-plan-card-heading"><span className="plan-name">GastroRed Pro</span><span className="plan-status">Próximamente</span></div>
            <strong>S/ 100 <small>al mes</small></strong>
            <p>Amplía tu búsqueda de 500 m hasta 1 km a la redonda.</p>
            <span className="plan-coming-soon">Suscripción y límites aún no activos</span>
          </article>
        </div>
        <p className="landing-plan-disclaimer">Planes informativos: todavía no hay suscripciones, cobros ni límites por plan activos. La disponibilidad de restaurantes depende de los datos de OpenStreetMap.</p>
      </section>

      <section className="landing-closing">
        <div>
          <span className="landing-eyebrow"><span /> TU SIGUIENTE ANTOJO TE ESPERA</span>
          <h2>¿Qué se te antoja <em>hoy?</em></h2>
        </div>
        <Link className="landing-button landing-button-primary" to="/restaurantes">Buscar restaurantes <ArrowRight size={17} /></Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-brand" to="/inicio">
          <span className="landing-brand-mark"><Utensils size={16} /></span>
          <span>GastroRed<small>BUENOS MOMENTOS, BUENA MESA</small></span>
        </Link>
        <p>Descubre restaurantes que se sienten como tu lugar favorito.</p>
        <nav aria-label="Enlaces de pie de página">
          <Link to="/inicio">Entrar a GastroRed</Link>
          <Link to="/creditos">Créditos de las fotografías</Link>
        </nav>
        <span className="landing-copyright">© 2026 GastroRed · Una guía independiente de restaurantes</span>
      </footer>
    </main>
  )
}
