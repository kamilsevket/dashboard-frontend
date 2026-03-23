export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
export const API = `${API_BASE}/api`
export const WS_URL = API_BASE.replace('http', 'ws').replace('https', 'wss')
export const STATIC = API_BASE

// Auth helper
export const getAuthHeaders = () => {
  const token = localStorage.getItem('dashboard_token')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

export const authFetch = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...getAuthHeaders()
    }
  })
  if (res.status === 401) {
    localStorage.removeItem('dashboard_token')
    window.location.reload()
  }
  return res
}
