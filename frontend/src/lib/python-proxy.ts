// Helper to proxy requests to the Python backend (port 8000)
// If Python is offline, return a fallback/empty response so the UI doesn't crash

const PYTHON_URL = 'http://localhost:8000'

export async function pythonGet(path: string): Promise<any> {
  try {
    const res = await fetch(`${PYTHON_URL}${path}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null // Python offline
  }
}

export async function pythonPost(path: string, body: any): Promise<any> {
  try {
    const res = await fetch(`${PYTHON_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false, error: `Python returned ${res.status}` }
    return await res.json()
  } catch {
    return { ok: false, error: 'Python core offline. Is server.py running on port 8000?' }
  }
}
