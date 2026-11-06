import { Navigate, useLocation } from 'react-router-dom'

export function OwnerLoginPage() {
  const location = useLocation()
  return <Navigate to="/login?account=restaurant" replace state={location.state} />
}
