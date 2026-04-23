import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";

const API_KEY          = import.meta.env.VITE_OWM_API_KEY;
const WEATHER_URL      = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_URL     = "https://api.openweathermap.org/data/2.5/forecast";
const GEO_URL          = "https://api.openweathermap.org/geo/1.0/direct";
const REVERSE_GEO_URL  = "https://api.openweathermap.org/geo/1.0/reverse";
const MARINE_URL       = "https://marine-api.open-meteo.com/v1/marine";
const LAKE_URL         = "https://api.open-meteo.com/v1/forecast";
const DAILY_URL        = "https://api.open-meteo.com/v1/forecast";

const DEFAULT_CITY = { name: "Gdańsk", country: "PL", state: "", lat: 54.3520, lon: 18.6466 };

const countryName = code => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code); }
  catch { return code; }
};

// ── water helpers ────────────────────────────────────────────────────────────

async function fetchMarineTemp(lat, lon) {
  try {
    const res = await fetch(`${MARINE_URL}?latitude=${lat}&longitude=${lon}&current=sea_surface_temperature`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d.error) return null;
    const t = d.current?.sea_surface_temperature;
    return typeof t === "number" ? t : null;
  } catch { return null; }
}

async function fetchLakeTemp(lat, lon) {
  try {
    const res = await fetch(
      `${LAKE_URL}?latitude=${lat}&longitude=${lon}&daily=lake_surface_temperature_mean&forecast_days=1&timezone=auto`
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (d.error) return null;
    const t = d.daily?.lake_surface_temperature_mean?.[0];
    return typeof t === "number" ? t : null;
  } catch { return null; }
}

function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SEAS = [
  { name: "Baltic Sea",         lat: 58.5, lon:  19.0 },
  { name: "Gulf of Finland",    lat: 60.0, lon:  26.0 },
  { name: "Gulf of Bothnia",    lat: 63.0, lon:  21.0 },
  { name: "Gulf of Riga",       lat: 57.5, lon:  23.5 },
  { name: "Kattegat",           lat: 57.0, lon:  11.5 },
  { name: "Skagerrak",          lat: 58.0, lon:   8.0 },
  { name: "North Sea",          lat: 56.0, lon:   3.0 },
  { name: "English Channel",    lat: 50.3, lon:  -1.5 },
  { name: "Irish Sea",          lat: 53.5, lon:  -5.0 },
  { name: "Norwegian Sea",      lat: 68.0, lon:   2.0 },
  { name: "Barents Sea",        lat: 74.0, lon:  36.0 },
  { name: "White Sea",          lat: 65.5, lon:  33.0 },
  { name: "Arctic Ocean",       lat: 85.0, lon:   0.0 },
  { name: "Atlantic Ocean",     lat: 50.0, lon: -14.0 },
  { name: "Atlantic Ocean",     lat: 38.0, lon: -65.0 },
  { name: "Atlantic Ocean",     lat: 14.0, lon: -20.0 },
  { name: "Atlantic Ocean",     lat:-30.0, lon: -20.0 },
  { name: "Mediterranean Sea",  lat: 38.0, lon:  15.0 },
  { name: "Adriatic Sea",       lat: 43.0, lon:  16.0 },
  { name: "Aegean Sea",         lat: 39.0, lon:  25.0 },
  { name: "Ionian Sea",         lat: 38.0, lon:  20.0 },
  { name: "Tyrrhenian Sea",     lat: 40.0, lon:  12.0 },
  { name: "Ligurian Sea",       lat: 44.0, lon:   9.0 },
  { name: "Alboran Sea",        lat: 35.8, lon:  -3.5 },
  { name: "Black Sea",          lat: 43.0, lon:  34.0 },
  { name: "Caspian Sea",        lat: 41.0, lon:  51.0 },
  { name: "Red Sea",            lat: 20.0, lon:  38.0 },
  { name: "Persian Gulf",       lat: 26.0, lon:  52.0 },
  { name: "Gulf of Oman",       lat: 23.0, lon:  58.0 },
  { name: "Arabian Sea",        lat: 15.0, lon:  65.0 },
  { name: "Bay of Bengal",      lat: 15.0, lon:  88.0 },
  { name: "Indian Ocean",       lat:  8.0, lon:  75.0 },
  { name: "Indian Ocean",       lat:-25.0, lon:  80.0 },
  { name: "Indian Ocean",       lat:-30.0, lon:  45.0 },
  { name: "Indian Ocean",       lat:-20.0, lon: 100.0 },
  { name: "Pacific Ocean",      lat: 48.0, lon:-127.0 },
  { name: "Pacific Ocean",      lat: 34.0, lon:-122.0 },
  { name: "Pacific Ocean",      lat: 20.0, lon:-108.0 },
  { name: "Pacific Ocean",      lat:-15.0, lon: -85.0 },
  { name: "Pacific Ocean",      lat:-40.0, lon:-100.0 },
  { name: "Pacific Ocean",      lat: 38.0, lon: 148.0 },
  { name: "Pacific Ocean",      lat:-30.0, lon: 165.0 },
  { name: "Pacific Ocean",      lat:  5.0, lon: 175.0 },
  { name: "South China Sea",    lat: 12.0, lon: 115.0 },
  { name: "East China Sea",     lat: 30.0, lon: 125.0 },
  { name: "Sea of Japan",       lat: 40.0, lon: 135.0 },
  { name: "Yellow Sea",         lat: 35.0, lon: 123.0 },
  { name: "Sea of Okhotsk",     lat: 55.0, lon: 150.0 },
  { name: "Bering Sea",         lat: 60.0, lon:-175.0 },
  { name: "Gulf of Alaska",     lat: 57.0, lon:-148.0 },
  { name: "Coral Sea",          lat:-18.0, lon: 153.0 },
  { name: "Tasman Sea",         lat:-38.0, lon: 158.0 },
  { name: "Caribbean Sea",      lat: 15.0, lon: -75.0 },
  { name: "Gulf of Mexico",     lat: 24.0, lon: -90.0 },
  { name: "Gulf of California", lat: 27.0, lon:-110.0 },
  { name: "Southern Ocean",     lat:-58.0, lon:   0.0 },
  { name: "Southern Ocean",     lat:-58.0, lon: -60.0 },
  { name: "Southern Ocean",     lat:-58.0, lon: 120.0 },
  { name: "Southern Ocean",     lat:-58.0, lon:-120.0 },
];

function nearestSeaName(lat, lon) {
  let best = { d: Infinity, name: "Nearby sea" };
  for (const sea of SEAS) {
    const d = haversineDist(lat, lon, sea.lat, sea.lon);
    if (d < best.d) best = { d, name: sea.name };
  }
  return best.name;
}

const MAX_LAKE_DIST = 80;
const LAKES = [
  { name: "Lake Śniardwy",    lat: 53.726, lon: 21.760 },
  { name: "Lake Mamry",       lat: 54.130, lon: 21.720 },
  { name: "Lake Niegocin",    lat: 54.030, lon: 21.790 },
  { name: "Lake Jeziorak",    lat: 53.730, lon: 19.620 },
  { name: "Lake Drawsko",     lat: 53.640, lon: 15.820 },
  { name: "Lake Wigry",       lat: 54.030, lon: 23.100 },
  { name: "Lake Gopło",       lat: 52.570, lon: 18.260 },
  { name: "Lake Vänern",      lat: 58.930, lon: 13.500 },
  { name: "Lake Vättern",     lat: 58.380, lon: 14.580 },
  { name: "Lake Mälaren",     lat: 59.530, lon: 17.000 },
  { name: "Lake Saimaa",      lat: 61.400, lon: 28.200 },
  { name: "Lake Päijänne",    lat: 61.530, lon: 25.530 },
  { name: "Lake Inari",       lat: 68.970, lon: 27.970 },
  { name: "Mjøsa",            lat: 60.670, lon: 10.670 },
  { name: "Lake Balaton",     lat: 46.870, lon: 17.730 },
  { name: "Lake Geneva",      lat: 46.450, lon:  6.550 },
  { name: "Lake Constance",   lat: 47.630, lon:  9.370 },
  { name: "Lake Maggiore",    lat: 45.950, lon:  8.630 },
  { name: "Lake Como",        lat: 46.000, lon:  9.280 },
  { name: "Lake Garda",       lat: 45.650, lon: 10.680 },
  { name: "Lake Ladoga",      lat: 60.830, lon: 31.500 },
  { name: "Lake Onega",       lat: 61.500, lon: 35.500 },
  { name: "Lake Peipus",      lat: 58.700, lon: 27.500 },
  { name: "Lake Baikal",      lat: 53.500, lon:108.000 },
  { name: "Lake Victoria",    lat: -1.000, lon: 33.000 },
  { name: "Lake Tanganyika",  lat: -6.000, lon: 29.500 },
  { name: "Lake Malawi",      lat:-11.000, lon: 34.500 },
  { name: "Lake Superior",    lat: 47.500, lon:-87.500 },
  { name: "Lake Michigan",    lat: 44.000, lon:-87.000 },
  { name: "Lake Huron",       lat: 44.800, lon:-82.400 },
  { name: "Lake Erie",        lat: 42.200, lon:-81.200 },
  { name: "Lake Ontario",     lat: 43.700, lon:-77.900 },
  { name: "Lake Winnipeg",    lat: 52.500, lon: -97.500 },
  { name: "Lake Titicaca",    lat:-15.800, lon: -69.300 },
  { name: "Lake Balkhash",    lat: 46.000, lon: 74.500 },
  { name: "Lake Issyk-Kul",   lat: 42.450, lon: 77.250 },
];

function nearestLakeName(lat, lon) {
  let best = { d: Infinity, name: null };
  for (const lake of LAKES) {
    const d = haversineDist(lat, lon, lake.lat, lake.lon);
    if (d < best.d) best = { d, name: lake.name };
  }
  return best.d <= MAX_LAKE_DIST ? best.name : null;
}

async function fetchWaterInfo(lat, lon) {
  const [marineTemp, lakeTemp] = await Promise.all([
    fetchMarineTemp(lat, lon),
    fetchLakeTemp(lat, lon),
  ]);
  if (marineTemp !== null) {
    return { temp: marineTemp, name: nearestSeaName(lat, lon), type: "sea" };
  }
  const lakeName = nearestLakeName(lat, lon);
  if (lakeTemp !== null) return { temp: lakeTemp, name: lakeName, type: "lake" };
  if (lakeName)           return { temp: null,    name: lakeName, type: "lake" };
  return null;
}

// ── hourly forecast (OWM 3-hourly, up to 24 entries = 72h) ──────────────────

// OWM weather id → emoji
function owmEmoji(id, icon) {
  const isNight = icon?.endsWith("n");
  if (id >= 200 && id < 300) return "⛈️";
  if (id >= 300 && id < 400) return "🌦️";
  if (id >= 500 && id < 600) return id >= 511 ? "🌨️" : id >= 502 ? "🌧️" : "🌦️";
  if (id >= 600 && id < 700) return "❄️";
  if (id >= 700 && id < 800) return "🌫️";
  if (id === 800) return isNight ? "🌙" : "☀️";
  if (id === 801) return isNight ? "🌤️" : "🌤️";
  if (id === 802) return "⛅";
  if (id >= 803) return "☁️";
  return "🌡️";
}

// Open-Meteo daily forecast — 14 days, no API key needed
const WMO_EMOJI = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  61: "🌦️", 63: "🌧️", 65: "🌧️",
  71: "❄️", 73: "❄️", 75: "❄️", 77: "❄️",
  80: "🌦️", 81: "🌧️", 82: "🌧️",
  85: "❄️", 86: "❄️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};
const WMO_DESC = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "icy fog",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "light showers", 81: "showers", 82: "heavy showers",
  85: "snow showers", 86: "heavy snow showers",
  95: "thunderstorm", 96: "thunderstorm w/ hail", 99: "thunderstorm w/ heavy hail",
};

async function fetchDailyForecast(lat, lon) {
  try {
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      daily: "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max",
      forecast_days: 14,
      timezone: "auto",
    });
    const res = await fetch(`${DAILY_URL}?${params}`);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.daily?.time?.length) return null;
    return d.daily.time.map((date, i) => ({
      date:   new Date(date + "T12:00:00"),
      code:   d.daily.weathercode[i],
      emoji:  WMO_EMOJI[d.daily.weathercode[i]] ?? "🌡️",
      desc:   WMO_DESC[d.daily.weathercode[i]]  ?? "unknown",
      max:    Math.round(d.daily.temperature_2m_max[i]),
      min:    Math.round(d.daily.temperature_2m_min[i]),
      precip: d.daily.precipitation_probability_max[i] ?? 0,
      wind:   Math.round(d.daily.windspeed_10m_max[i]),
    }));
  } catch { return null; }
}

// OWM /data/2.5/forecast gives 3-hourly slots, up to 40 entries (5 days)
async function fetchHourlyForecast(lat, lon) {
  try {
    const res = await fetch(
      `${FORECAST_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=24`
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.list?.length) return null;
    return d.list.map(item => ({
      time:   new Date(item.dt * 1000),
      temp:   Math.round(item.main.temp),
      desc:   item.weather[0].description,
      emoji:  owmEmoji(item.weather[0].id, item.weather[0].icon),
      precip: Math.round((item.pop ?? 0) * 100),
    }));
  } catch { return null; }
}

// ── misc helpers ─────────────────────────────────────────────────────────────

async function geocode(query) {
  const res = await fetch(`${GEO_URL}?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`);
  if (!res.ok) throw new Error("Geocoding failed");
  return res.json();
}

async function reverseGeocode(lat, lon) {
  const res = await fetch(`${REVERSE_GEO_URL}?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  const r = data[0];
  return { name: r.name, country: r.country, state: r.state ?? "", lat: r.lat, lon: r.lon };
}

function iconUrl(code) {
  return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

function formatTime(date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function WindDirection({ deg }) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return (
    <span className="wind-dir">
      <span className="wind-arrow" style={{ transform: `rotate(${deg}deg)` }}>↑</span>
      {dirs[Math.round(deg / 45) % 8]}
    </span>
  );
}

// ── component ────────────────────────────────────────────────────────────────

const MAX_MESSAGES = 20; // v2

export default function App() {
  // ── state ────────────────────────────────────────────────────────────────────
  const [city, setCity]               = useState(DEFAULT_CITY);
  const [query, setQuery]             = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [geoLoading, setGeoLoading]   = useState(false);
  const [geoError, setGeoError]       = useState("");
  const [locating, setLocating]       = useState(false);
  const [tab, setTab]                 = useState("now");
  const [weather, setWeather]         = useState(null);
  const [waterInfo, setWaterInfo]     = useState(undefined);
  const [forecast, setForecast]       = useState(null);
  const [daily, setDaily]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [chatOpen, setChatOpen]       = useState(false);
  const [messages, setMessages]       = useState([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // ── refs ─────────────────────────────────────────────────────────────────────
  const inputRef      = useRef(null);
  const chatBottomRef = useRef(null);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const result = await reverseGeocode(lat, lon);
        setCity(result ?? { name: "My Location", country: "", state: "", lat, lon });
        setLocating(false);
      },
      () => {
        setGeoError("Location access denied.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }, []);

  // Auto-locate on first load
  useEffect(() => { useMyLocation(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWaterInfo(undefined);
    const { lat, lon } = city;
    try {
      const [weatherRes, water, hours, days] = await Promise.all([
        fetch(`${WEATHER_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`),
        fetchWaterInfo(lat, lon),
        fetchHourlyForecast(lat, lon),
        fetchDailyForecast(lat, lon),
      ]);
      if (!weatherRes.ok) throw new Error(`Weather API error ${weatherRes.status}`);
      setWeather(await weatherRes.json());
      setWaterInfo(water ?? null);
      setForecast(hours);
      setDaily(days);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setGeoError("");
    setSuggestions([]);
    setGeoLoading(true);
    try {
      const results = await geocode(query.trim());
      if (!results.length) { setGeoError("No cities found."); return; }
      if (results.length === 1) { pickCity(results[0]); return; }
      setSuggestions(results);
    } catch {
      setGeoError("Search failed — check your connection.");
    } finally {
      setGeoLoading(false);
    }
  };

  const pickCity = (result) => {
    setCity({ name: result.name, country: result.country, state: result.state ?? "", lat: result.lat, lon: result.lon });
    setQuery("");
    setSuggestions([]);
    setGeoError("");
  };

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    if (messages.length >= MAX_MESSAGES) return;

    const userMsg = { role: "user", content: chatInput.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setChatInput("");
    setChatLoading(true);

    const needsSearch = /flight|price|event|hotel|current|today|now|this week|news|ticket/i.test(userMsg.content);

    const systemPrompt = weather
      ? `You are a helpful travel and weather assistant built into a weather app.
The user is currently viewing weather for: ${city.name}${city.country ? ", " + countryName(city.country) : ""}.
Current conditions: ${Math.round(weather.main.temp)}°C, ${weather.weather[0].description}.
Help them plan travel or understand weather. When suggesting cities to visit, format them as [CITY: CityName] so the app can make them tappable and load weather for that city instantly.
Be concise — this is a mobile chat panel.`
      : "You are a helpful travel and weather assistant. Be concise.";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated, systemPrompt, useSearch: needsSearch }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `Sorry, something went wrong: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, messages, city, weather]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const renderChatMessage = (text) => {
    const parts = text.split(/\[CITY: ([^\]]+)\]/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <button key={i} className="city-chip" onClick={() => { setQuery(part); setChatOpen(false); }}>
          📍 {part}
        </button>
      ) : part
    );
  };

  if (error && !weather) {
    return (
      <div className="screen error-screen">
        <p className="error-msg">Failed to load weather: {error}</p>
        <button className="refresh-btn" onClick={fetchAll}>Try again</button>
      </div>
    );
  }

  if (loading && !weather) {
    return (
      <div className="screen loading-screen">
        <div className="spinner" />
        <p>Loading {city.name} weather…</p>
      </div>
    );
  }

  const { main, weather: conditions, wind, clouds, visibility, sys } = weather;
  const condition = conditions[0];
  const isDay = Date.now() / 1000 > sys.sunrise && Date.now() / 1000 < sys.sunset;

  const waterIcon  = waterInfo?.type === "lake" ? "🏞️" : "🌊";
  const waterLabel = waterInfo?.name
    ?? (waterInfo?.type === "lake" ? "Nearby lake" : "Nearby sea");

  return (
    <>
    <div className={`screen main-screen ${isDay ? "day" : "night"}`}>
      <div className="card">

        {/* Search */}
        <form className="search-form" onSubmit={handleSearch}>
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            placeholder="Search any city…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSuggestions([]); setGeoError(""); }}
          />
          <button
            className="search-btn loc-btn"
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            title="Use my location"
          >
            {locating ? <span className="spinner-sm" /> : "📍"}
          </button>
          <button className="search-btn" type="submit" disabled={geoLoading}>
            {geoLoading ? <span className="spinner-sm" /> : "→"}
          </button>
        </form>

        {suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button className="suggestion-item" onClick={() => pickCity(s)}>
                  <strong>{s.name}</strong>
                  <span>{s.state ? `${s.state}, ` : ""}{countryName(s.country)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {geoError && <p className="geo-error">{geoError}</p>}

        {/* Header */}
        <div className="card-top">
          <div className="location">
            <span className="city-name">{city.name}</span>
            <span className="country-name">
              {city.state ? `${city.state}, ` : ""}{countryName(city.country)}
            </span>
          </div>
          <button
            className={`refresh-btn icon-btn ${loading ? "spinning" : ""}`}
            onClick={fetchAll}
            disabled={loading}
            title="Refresh"
          >↻</button>
        </div>

        {/* Main temp — always visible */}
        <div className="hero">
          <img className="weather-icon" src={iconUrl(condition.icon)} alt={condition.description} />
          <div className="temp-block">
            <span className="temp">{Math.round(main.temp)}°</span>
            <span className="unit">C</span>
          </div>
        </div>
        <p className="description">{condition.description}</p>
        <p className="feels-like">Feels like {Math.round(main.feels_like)}°C</p>

        {/* Tab bar */}
        <div className="tab-bar">
          <button className={`tab-btn ${tab === "now"    ? "active" : ""}`} onClick={() => setTab("now")}>Now</button>
          <button className={`tab-btn ${tab === "72h"    ? "active" : ""}`} onClick={() => setTab("72h")}>72h</button>
          <button className={`tab-btn ${tab === "14days" ? "active" : ""}`} onClick={() => setTab("14days")}>14 days</button>
        </div>

        {/* Tab: Now */}
        {tab === "now" && (
          <>
            <div className="stats">
              <div className="stat">
                <span className="stat-label">Humidity</span>
                <span className="stat-value">{main.humidity}%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Wind</span>
                <span className="stat-value">
                  {Math.round(wind.speed * 3.6)} km/h{" "}
                  {wind.deg !== undefined && <WindDirection deg={wind.deg} />}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Pressure</span>
                <span className="stat-value">{main.pressure} hPa</span>
              </div>
              <div className="stat">
                <span className="stat-label">Cloud cover</span>
                <span className="stat-value">{clouds.all}%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Visibility</span>
                <span className="stat-value">{(visibility / 1000).toFixed(1)} km</span>
              </div>
              <div className="stat">
                <span className="stat-label">Sunrise / Set</span>
                <span className="stat-value">
                  {formatTime(new Date(sys.sunrise * 1000))} / {formatTime(new Date(sys.sunset * 1000))}
                </span>
              </div>
            </div>

            {waterInfo === undefined && (
              <div className="water-section water-loading">
                <span className="spinner-sm" />
                <span className="water-label">Looking for nearby water…</span>
              </div>
            )}
            {waterInfo !== null && waterInfo !== undefined && (
              <div className={`water-section ${waterInfo.type}`}>
                <div className="water-icon">{waterIcon}</div>
                <div className="water-info">
                  <span className="water-label">{waterLabel}</span>
                  {waterInfo.temp !== null
                    ? <span className="water-temp">{Math.round(waterInfo.temp)}°C</span>
                    : <span className="water-temp no-temp">temp unavailable</span>
                  }
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab: 72h */}
        {tab === "72h" && (
          <div className="forecast-section">
            {forecast && forecast.length > 0 ? (
              <div className="forecast-grid">
                {forecast.map((h, i) => (
                  <div key={i} className={`forecast-row ${i === 0 ? "now" : ""}`}>
                    <span className="forecast-hour">
                      {i === 0 ? "Now" : h.time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="forecast-day">
                      {h.time.toLocaleDateString("en-GB", { weekday: "short" })}
                    </span>
                    <span className="forecast-emoji">{h.emoji}</span>
                    <span className="forecast-desc">{h.desc}</span>
                    <span className="forecast-temp">{h.temp}°C</span>
                    <span className="forecast-precip">{h.precip > 0 ? `💧${h.precip}%` : ""}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">Forecast unavailable</p>
            )}
          </div>
        )}

        {/* Tab: 14 days */}
        {tab === "14days" && (
          <div className="forecast-section">
            {daily && daily.length > 0 ? (
              <div className="forecast-grid">
                {daily.map((d, i) => (
                  <div key={i} className={`forecast-row daily-row ${i === 0 ? "now" : ""}`}>
                    <span className="forecast-day-label">
                      {i === 0 ? "Today" : d.date.toLocaleDateString("en-GB", { weekday: "short" })}
                    </span>
                    <span className="forecast-date">
                      {d.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                    <span className="forecast-emoji">{d.emoji}</span>
                    <span className="forecast-desc">{d.desc}</span>
                    <span className="forecast-range">
                      <span className="temp-max">{d.max}°</span>
                      <span className="temp-min">{d.min}°</span>
                    </span>
                    <span className="forecast-precip">{d.precip > 0 ? `💧${d.precip}%` : ""}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">Forecast unavailable</p>
            )}
          </div>
        )}

        {lastUpdated && <p className="updated">Updated at {formatTime(lastUpdated)}</p>}
      </div>
    </div>

      {/* Floating chat button — outside .screen so position:fixed works */}
      <button
        className="chat-fab"
        onClick={() => setChatOpen(o => !o)}
        title="Ask the weather assistant"
      >
        {chatOpen ? "✕" : "💬"}
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <span>✈️ Travel & Weather Assistant</span>
            {messages.length > 0 && (
              <button className="chat-clear" onClick={() => setMessages([])}>Clear</button>
            )}
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="chat-empty">Ask me where to travel based on weather, or anything about {city.name} ☀️</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role}`}>
                {m.role === "assistant" ? renderChatMessage(m.content) : m.content}
              </div>
            ))}
            {chatLoading && (
              <div className="chat-bubble assistant chat-thinking">
                <span className="spinner-sm" /> thinking…
              </div>
            )}
            {messages.length >= MAX_MESSAGES && (
              <p className="chat-limit">Message limit reached. Clear chat to continue.</p>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="chat-input-row">
            <input
              className="chat-input"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendChatMessage()}
              placeholder="Where should I go next week?"
              disabled={chatLoading || messages.length >= MAX_MESSAGES}
            />
            <button
              className="chat-send"
              onClick={sendChatMessage}
              disabled={chatLoading || !chatInput.trim() || messages.length >= MAX_MESSAGES}
            >↑</button>
          </div>
        </div>
      )}
    </>
  );
}
