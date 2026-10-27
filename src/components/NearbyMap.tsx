import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Restaurant } from '../types'
import { formatDistance, type UserLocation } from '../features/location/location'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function NearbyMap({
  location,
  places,
  radius,
}: {
  location: UserLocation
  places: Restaurant[]
  radius: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (!mapRef.current) {
      mapRef.current = L.map(container, {
        center: [location.latitude, location.longitude],
        zoom: 16,
        zoomControl: true,
        scrollWheelZoom: false,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      }).addTo(mapRef.current)
      layerRef.current = L.layerGroup().addTo(mapRef.current)
    }

    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    const center = L.latLng(location.latitude, location.longitude)
    L.circle(center, {
      radius,
      color: '#b3391e',
      weight: 1,
      fillColor: '#b3391e',
      fillOpacity: 0.07,
    }).addTo(layer)
    L.circleMarker(center, {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: '#b3391e',
      fillOpacity: 1,
    }).bindTooltip('Tu ubicación').addTo(layer)

    const bounds: L.LatLngExpression[] = [center]
    for (const place of places) {
      const marker = L.marker([place.latitude, place.longitude], {
        title: place.name,
        icon: L.divIcon({
          className: 'nearby-map-marker',
          html: `<span>${escapeHtml(place.name.slice(0, 2).toLocaleUpperCase('es'))}</span>`,
          iconSize: [29, 29],
          iconAnchor: [14, 14],
        }),
      })
      marker.bindPopup(
        `<strong>${escapeHtml(place.name)}</strong><br><span>${escapeHtml(place.cuisine)} · ${formatDistance(place.distanceKm)}</span>`,
      )
      marker.addTo(layer)
      bounds.push([place.latitude, place.longitude])
    }

    map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 17 })
    window.setTimeout(() => map.invalidateSize(), 60)
  }, [location.latitude, location.longitude, radius, places])

  useEffect(() => () => {
    mapRef.current?.remove()
    mapRef.current = null
    layerRef.current = null
  }, [])

  return (
    <div
      className="nearby-map"
      ref={containerRef}
      role="region"
      aria-label={`Mapa con ${places.length} ${places.length === 1 ? 'restaurante cercano' : 'restaurantes cercanos'} y un radio de ${radius} metros`}
    />
  )
}
