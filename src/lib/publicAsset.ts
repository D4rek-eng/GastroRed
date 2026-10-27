export function publicAsset(path: string) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
