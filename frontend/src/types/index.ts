export type Destination = {
  id: string; name: string; country: string; country_code: string; flag: string;
  timezone: string; latitude: number; longitude: number; subtitle?: string; destination_type?: string;
}

export type ForecastDay = {
  date: string; day: string; icon: string; condition: string; high: number; low: number;
  rain_probability: number; score: number; label: string;
}

export type HourlyPoint = {
  time: string; temperature: number; feels_like: number; precipitation: number; wind: number; uv: number; icon: string;
}

export type ActivityRecommendation = {
  name: string; icon: string; score: number; rating: number; best_time: string; suitability: string; reason: string;
}

export type ItineraryItem = {
  id: string; time: string; title: string; duration_minutes?: number | null; location?: { provider: 'google'; place_id: string } | null; weather_icon?: string; temperature?: number; category: string;
}

export type PackingItem = { id: string; name: string; quantity: number; packed: boolean; category: string; reason?: string }

export type TripAnalysis = {
  trip_id: string;
  destination: Destination;
  date_range: string;
  current: { temperature: number; feels_like: number; condition: string; icon: string; humidity: number; wind: number; visibility: number; uv: number; precipitation: number };
  summary: { score: number; label: string; headline: string; description: string; recommendation: string; confidence: string };
  score_breakdown: Record<string, number>;
  forecast: ForecastDay[];
  hourly: HourlyPoint[];
  activities: ActivityRecommendation[];
  itinerary: { travel_mode?: 'DRIVE' | 'WALK' | 'BICYCLE'; date: string; label: string; headline: string; items: ItineraryItem[]; avoid?: string }[];
  packing: PackingItem[];
  risks: { level: string; title: string; detail: string; recommendation: string; factors: { name: string; level: string }[] };
}

export type InitialPlan = Pick<PrivatePlan, 'itinerary' | 'packing'>
export type DraftResult = { output_language?: string; draft: InitialPlan; source: string; weather_source: string; forecast_days: number; warnings: string[] }

export type TripStopInput = { destination_id: string; arrival_date: string; departure_date: string }
export type TripStop = { id: string; position: number; arrival_date: string; departure_date: string; destination: Destination }
export type TripCreate = {
  stops?: TripStopInput[];
  title?: string; initial_plan?: InitialPlan; request_id?: string;
  destination_id: string; departure_date: string; return_date: string; travel_style: string; activities: string[];
}

export type TripSummary = {
  id: string; title: string; departure_date: string; return_date: string; travel_style: string; status: string;
  destination: Destination; stops?: TripStop[];
}

export type UserSettings = {
  displayName: string; temperatureUnit: 'C' | 'F'; distanceUnit: 'km' | 'mi';
  travelPace: 'relaxed' | 'balanced' | 'active'; emailAlerts: boolean; pushAlerts: boolean;
  severeWeatherOnly: boolean;
}

export type PrivatePlan = {
  trip_id: string; title: string; departure_date: string; return_date: string;
  destination: Destination; revision: number; stops?: TripStop[];
  itinerary: TripAnalysis['itinerary']; packing: PackingItem[];
}

export type RoutingConfig = { provider: string; places_available: boolean; routing_available: boolean; browser_key: string; map_available: boolean; max_activities: number; limits: { routes_per_minute: number; routes_per_day: number; places_per_minute: number; places_per_day: number }; note: string }
export type GooglePlace = { place_id: string; name: string; address: string; latitude: number; longitude: number; attributions: { provider: string; providerUri?: string }[] }
export type ScheduleCheck = { status: 'conflicts' | 'incomplete' | 'no_conflicts_detected'; issues: { code: string; activity_id?: string; message: string }[]; segments: { from_id: string; to_id: string; available_minutes: number | null; travel_minutes: number | null; buffer_minutes: number; shortage_minutes: number | null }[]; travel_checked: boolean; note: string }
export type ActivityRoute = { provider: string; mode: string; distance_meters: number; duration_seconds: number; polyline: string; legs: { duration_seconds: number; distance_meters: number; start: { latitude: number; longitude: number }; end: { latitude: number; longitude: number } }[]; warnings: string[]; activity_ids: string[]; generated_at: string; notice: string; schedule: ScheduleCheck }
