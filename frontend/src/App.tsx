import { useQueryClient } from '@tanstack/react-query'
import { getSession, initializeAuth } from './features/auth/session'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Skeleton } from './components/ui/Skeleton'

const AuthRecoveryPage = lazy(() => import('./pages/AuthRecoveryPage').then(module => ({ default: module.AuthRecoveryPage })))
const LandingPage = lazy(() => import('./pages/LandingPage').then(module => ({ default: module.LandingPage })))
const PlannerPage = lazy(() => import('./pages/PlannerPage').then(module => ({ default: module.PlannerPage })))
const TripDashboardPage = lazy(() => import('./pages/TripDashboardPage').then(module => ({ default: module.TripDashboardPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })))
const TripsPage = lazy(() => import('./pages/TripsPage').then(module => ({ default: module.TripsPage })))
const ExplorePage = lazy(() => import('./pages/ExplorePage').then(module => ({ default: module.ExplorePage })))
const SavedDestinationsPage = lazy(() => import('./pages/SavedDestinationsPage').then(module => ({ default: module.SavedDestinationsPage })))
const ComparisonPage = lazy(() => import('./pages/ComparisonPage').then(module => ({ default: module.ComparisonPage })))
const WeatherMapPage = lazy(() => import('./pages/WeatherMapPage').then(module => ({ default: module.WeatherMapPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(module => ({ default: module.NotificationsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })))

const SharedTripPage = lazy(() => import('./pages/SharedTripPage').then(module => ({ default: module.SharedTripPage })))
const LegalPage = lazy(() => import('./pages/LegalPage').then(module => ({ default: module.LegalPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then(module => ({ default: module.AuthPage })))
function RequireAccount() {
  const location = useLocation()
  return getSession() ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash, plannerState: location.state }} />
}

function PageFallback() {
  return <div className="min-h-screen bg-cream p-6 md:p-12"><Skeleton className="h-10 w-52" /><div className="mx-auto mt-24 max-w-5xl space-y-5"><Skeleton className="h-14 w-2/3" /><Skeleton className="h-5 w-1/2" /><Skeleton className="mt-10 h-64 w-full rounded-2xl" /></div></div>
}
export function App() {
  const queryClient=useQueryClient()
  const [ready,setReady]=useState(false); const [authError,setAuthError]=useState(''); const [,render]=useState(0)
  useEffect(()=>{
    let active=true
    let previousUser=getSession()?.user.id
    const update=()=>{const nextUser=getSession()?.user.id;if(nextUser!==previousUser)queryClient.clear();previousUser=nextUser;render(value=>value+1)}
    window.addEventListener('travel-auth-change',update)
    initializeAuth().then(()=>{if(active)setReady(true)}).catch(error=>{if(active)setAuthError(error.message)})
    return()=>{active=false;window.removeEventListener('travel-auth-change',update)}
  },[queryClient])
  if(authError)return <main className="p-8"><h1 className="text-2xl">Session unavailable</h1><p role="alert" className="my-4">{authError}</p><button onClick={()=>window.location.reload()} className="underline">Retry</button></main>
  if(!ready)return <PageFallback/>
  return <Suspense fallback={<PageFallback />}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthPage key="login" mode="login" />} />
    <Route path="/register" element={<AuthPage key="register" mode="register" />} />
    <Route path="/auth/callback" element={<AuthRecoveryPage mode="callback"/>}/>
    <Route path="/forgot-password" element={<AuthRecoveryPage mode="request"/>}/>
    <Route path="/reset-password" element={<AuthRecoveryPage mode="reset"/>}/>
    <Route path="/legal/:document" element={<LegalPage />} />
    <Route path="/share" element={<SharedTripPage />} />
    <Route element={<RequireAccount />}>
    <Route path="/planner" element={<PlannerPage />} />
    <Route path="/app" element={<DashboardPage />} />
    <Route path="/app/trips" element={<TripsPage />} />
    <Route path="/app/explore" element={<ExplorePage />} />
    <Route path="/app/saved" element={<SavedDestinationsPage />} />
    <Route path="/app/compare" element={<ComparisonPage />} />
    <Route path="/app/weather-map" element={<WeatherMapPage />} />
    <Route path="/app/notifications" element={<NotificationsPage />} />
    <Route path="/app/settings" element={<SettingsPage />} />
    <Route path="/app/settings/:section" element={<SettingsPage />} />
    <Route path="/trip/:tripId" element={<TripDashboardPage />} />
    </Route>
    <Route path="*" element={<LandingPage />} />
  </Routes></Suspense>
}
