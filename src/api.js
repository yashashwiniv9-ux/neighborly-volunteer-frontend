const API = '/api'

async function csrfToken() {
  const response = await fetch(`${API}/auth/csrf`, { credentials: 'include' })
  if (!response.ok) throw new Error('Could not start a secure session. Please refresh and try again.')
  return (await response.json()).token
}

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = { ...(options.headers || {}) }
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-XSRF-TOKEN'] = await csrfToken()
  const response = await fetch(`${API}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  })
  if (response.status === 204) return null
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('neighborly:unauthorized'))
    throw new Error(payload?.message || 'Something went wrong. Please try again.')
  }
  return payload
}
