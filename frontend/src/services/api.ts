import { getAccessSession, supabase, supabaseLogin, supabaseRegister, type AuthResponse } from '../features/auth/session'
import type { Destination, PrivatePlan, TripAnalysis, TripCreate, TripSummary } from '../types'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

type Envelope<T> = { success: boolean; data: T; meta?: Record<string, unknown>; error?: { code: string; message: string } }

async function requestEnvelope<T>(path: string, options?: RequestInit): Promise<Envelope<T>> {
  const session = await getAccessSession()
  const response = await fetch(`${API_ORIGIN}/api/v1${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}`, 'X-App-Token': session.access_token } : {}), ...(options?.headers || {}) },
  })
  let body:Envelope<T>
  try{body=await response.json()}catch{throw new Error('The service returned an unexpected response. Please try again shortly.')}
  if (!response.ok || !body.success) throw new Error(body.error?.message || 'Something went wrong')
  return body
}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return (await requestEnvelope<T>(path, options)).data
}

export type ShareLink = { id: string; permission: 'view' | 'edit'; expires_at: string; created_at: string; revoked: boolean }
export type SharedPlan = { plan: PrivatePlan; permission: 'view' | 'edit'; expires_at: string }

export const api = {
  routingConfig: () => request<import('../types').RoutingConfig>('/routing/config'),
  searchActivityPlaces: (tripId: string, data: { query: string; day_date: string; session_token: string }, signal?: AbortSignal) => request<{ place_id: string; text: string }[]>(`/trips/${tripId}/places/search`, { method:'POST', body:JSON.stringify(data), signal }),
  activityPlaceDetails: (tripId: string, data: { place_id: string; session_token?: string }) => request<import('../types').GooglePlace>(`/trips/${tripId}/places/details`, { method:'POST', body:JSON.stringify(data) }),
  routeActivities: (tripId: string, data: { revision: number; day_date: string; buffer_minutes: number }) => request<import('../types').ActivityRoute>(`/trips/${tripId}/route`, { method:'POST', body:JSON.stringify(data) }),
  checkSchedule: (tripId: string, data: { revision: number; day_date: string; buffer_minutes: number }) => request<import('../types').ScheduleCheck>(`/trips/${tripId}/schedule`, { method:'POST', body:JSON.stringify(data) }),
  saveStops: (id: string, payload: { revision: number; stops: import('../types').TripStopInput[]; confirm_reassignment: boolean }) => request<PrivatePlan>(`/trips/${id}/stops`, { method: 'PUT', body: JSON.stringify(payload) }),
  planningOptions: () => request<{ ai_available: boolean; max_assisted_days: number; provider: string | null }>('/ai/planning-options'),
  generatePlanDraft: (payload: TripCreate & { mode: 'ai' | 'guided'; pace: 'easy' | 'balanced' | 'active'; notes: string; output_language?: string; ai_consent: boolean }) => request<import('../types').DraftResult>('/ai/plan-draft', { method: 'POST', body: JSON.stringify(payload) }),
  listShares: (id: string) => request<ShareLink[]>(`/trips/${id}/shares`),
  createShare: (id: string, permission: 'view' | 'edit', days: number) => request<ShareLink & { token: string }>(`/trips/${id}/shares`, { method: 'POST', body: JSON.stringify({ permission, expires_in_days: days }) }),
  revokeShare: (id: string, shareId: string) => request<{ revoked: boolean }>(`/trips/${id}/shares/${shareId}`, { method: 'DELETE' }),
  getSharedPlan: (token: string) => request<SharedPlan>('/shared/plan', { headers: { 'X-Trip-Share': token }, cache: 'no-store' }),
  saveSharedPlan: (token: string, plan: Pick<PrivatePlan, 'itinerary' | 'packing' | 'revision'>) => request<{ revision: number; saved: boolean }>('/shared/plan', { method: 'PUT', headers: { 'X-Trip-Share': token }, body: JSON.stringify(plan) }),
  exportTrip: async (id: string, kind: 'calendar' | 'pdf' | 'offline') => {
    const session = await getAccessSession()
    const response = await fetch(`${API_ORIGIN}/api/v1/trips/${id}/export/${kind}`, { headers: session ? { Authorization: `Bearer ${session.access_token}`, 'X-App-Token': session.access_token } : {}, cache: 'no-store' })
    if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message || 'Export failed. Please try again.') }
    return response.blob()
  },
  getPlan: (id: string) => request<PrivatePlan>(`/trips/${id}/plan`),
  savePlan: (id: string, plan: Pick<PrivatePlan, 'itinerary' | 'packing' | 'revision'>) => request<{ revision: number; saved: boolean }>(`/trips/${id}/plan`, { method: 'PUT', body: JSON.stringify(plan) }),
  getForecast: (lat: number, lon: number, start: string) => request<import('../types').ForecastDay[]>(`/weather/forecast?latitude=${lat}&longitude=${lon}&start_date=${start}&days=16`),
  getMapWeather: (latitude: number, longitude: number) => requestEnvelope<{ temperature: number; feels_like: number; condition: string; icon: string; humidity: number; wind: number; uv: number; precipitation: number; observed_at?: string; timezone?: string; retrieved_at?: string; data_kind?: string }>(`/weather/current?latitude=${latitude}&longitude=${longitude}`),
  register: (payload: { display_name: string; email: string; password: string }) => supabase ? supabaseRegister(payload.email,payload.password,payload.display_name) : request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) => supabase ? supabaseLogin(payload.email,payload.password) : request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  searchDestinations: (query: string) => request<Destination[]>(`/destinations/search?q=${encodeURIComponent(query)}`),
  getCurrentWeather: (latitude: number, longitude: number) => request<{ temperature: number; feels_like: number; condition: string; icon: string; humidity: number; wind: number; visibility: number; uv: number; precipitation: number }>(`/weather/current?latitude=${latitude}&longitude=${longitude}`),
  createTrip: (payload: TripCreate) => request<{ id: string }>('/trips', { method: 'POST', body: JSON.stringify(payload) }),
  listTrips: () => request<TripSummary[]>('/trips'),
  deleteTrip: (id: string) => request<{ deleted: boolean }>(`/trips/${id}`, { method: 'DELETE' }),
  getTripAnalysis: (id: string) => request<TripAnalysis>(`/trips/${id}/analysis`),
  optimizeDay: (id: string) => request<{ message: string; itinerary: TripAnalysis['itinerary'] }>(`/trips/${id}/optimize`, { method: 'POST' }),
  chat: (tripId: string, message: string) => request<{ answer: string; grounded_in: string[] }>('/ai/chat', { method: 'POST', body: JSON.stringify({ trip_id: tripId, message }) }),
}
