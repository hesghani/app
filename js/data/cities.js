// Built-in city list so location works offline, without sending a search anywhere.
// [name, country, lat, lng, time zone, aliases]
const RAW = [
  ['Makkah', 'Saudi Arabia', 21.4225, 39.8262, 'Asia/Riyadh', 'Mecca'],
  ['Madinah', 'Saudi Arabia', 24.4672, 39.6111, 'Asia/Riyadh', 'Medina'],
  ['Riyadh', 'Saudi Arabia', 24.7136, 46.6753, 'Asia/Riyadh'],
  ['Jeddah', 'Saudi Arabia', 21.4858, 39.1925, 'Asia/Riyadh'],
  ['Dammam', 'Saudi Arabia', 26.4207, 50.0888, 'Asia/Riyadh'],
  ['Dubai', 'UAE', 25.2048, 55.2708, 'Asia/Dubai'],
  ['Abu Dhabi', 'UAE', 24.4539, 54.3773, 'Asia/Dubai'],
  ['Sharjah', 'UAE', 25.3463, 55.4209, 'Asia/Dubai'],
  ['Doha', 'Qatar', 25.2854, 51.531, 'Asia/Qatar'],
  ['Kuwait City', 'Kuwait', 29.3759, 47.9774, 'Asia/Kuwait'],
  ['Manama', 'Bahrain', 26.2285, 50.586, 'Asia/Bahrain'],
  ['Muscat', 'Oman', 23.588, 58.3829, 'Asia/Muscat'],
  ['Sanaa', 'Yemen', 15.3694, 44.191, 'Asia/Aden'],
  ['Amman', 'Jordan', 31.9454, 35.9284, 'Asia/Amman'],
  ['Jerusalem', 'Al-Quds', 31.7683, 35.2137, 'Asia/Jerusalem', 'Al-Quds'],
  ['Gaza', 'Palestine', 31.5017, 34.4668, 'Asia/Gaza'],
  ['Ramallah', 'Palestine', 31.9038, 35.2034, 'Asia/Hebron'],
  ['Beirut', 'Lebanon', 33.8938, 35.5018, 'Asia/Beirut'],
  ['Damascus', 'Syria', 33.5138, 36.2765, 'Asia/Damascus'],
  ['Aleppo', 'Syria', 36.2021, 37.1343, 'Asia/Damascus'],
  ['Baghdad', 'Iraq', 33.3152, 44.3661, 'Asia/Baghdad'],
  ['Erbil', 'Iraq', 36.1911, 44.0092, 'Asia/Baghdad'],
  ['Basra', 'Iraq', 30.5085, 47.7804, 'Asia/Baghdad'],
  ['Tehran', 'Iran', 35.6892, 51.389, 'Asia/Tehran'],
  ['Mashhad', 'Iran', 36.2605, 59.6168, 'Asia/Tehran'],
  ['Isfahan', 'Iran', 32.6546, 51.668, 'Asia/Tehran'],
  ['Istanbul', 'Türkiye', 41.0082, 28.9784, 'Europe/Istanbul'],
  ['Ankara', 'Türkiye', 39.9334, 32.8597, 'Europe/Istanbul'],
  ['Izmir', 'Türkiye', 38.4237, 27.1428, 'Europe/Istanbul'],
  ['Bursa', 'Türkiye', 40.1885, 29.061, 'Europe/Istanbul'],
  ['Konya', 'Türkiye', 37.8746, 32.4932, 'Europe/Istanbul'],
  ['Baku', 'Azerbaijan', 40.4093, 49.8671, 'Asia/Baku'],
  ['Cairo', 'Egypt', 30.0444, 31.2357, 'Africa/Cairo'],
  ['Alexandria', 'Egypt', 31.2001, 29.9187, 'Africa/Cairo'],
  ['Khartoum', 'Sudan', 15.5007, 32.5599, 'Africa/Khartoum'],
  ['Tripoli', 'Libya', 32.8872, 13.1913, 'Africa/Tripoli'],
  ['Tunis', 'Tunisia', 36.8065, 10.1815, 'Africa/Tunis'],
  ['Algiers', 'Algeria', 36.7538, 3.0588, 'Africa/Algiers'],
  ['Oran', 'Algeria', 35.6971, -0.6308, 'Africa/Algiers'],
  ['Casablanca', 'Morocco', 33.5731, -7.5898, 'Africa/Casablanca'],
  ['Rabat', 'Morocco', 34.0209, -6.8416, 'Africa/Casablanca'],
  ['Marrakesh', 'Morocco', 31.6295, -7.9811, 'Africa/Casablanca', 'Marrakech'],
  ['Fez', 'Morocco', 34.0181, -5.0078, 'Africa/Casablanca', 'Fes'],
  ['Tangier', 'Morocco', 35.7595, -5.834, 'Africa/Casablanca'],
  ['Nouakchott', 'Mauritania', 18.0735, -15.9582, 'Africa/Nouakchott'],
  ['Dakar', 'Senegal', 14.7167, -17.4677, 'Africa/Dakar'],
  ['Bamako', 'Mali', 12.6392, -8.0029, 'Africa/Bamako'],
  ['Niamey', 'Niger', 13.5116, 2.1254, 'Africa/Niamey'],
  ['Abidjan', 'Côte d’Ivoire', 5.36, -4.0083, 'Africa/Abidjan'],
  ['Accra', 'Ghana', 5.6037, -0.187, 'Africa/Accra'],
  ['Lagos', 'Nigeria', 6.5244, 3.3792, 'Africa/Lagos'],
  ['Abuja', 'Nigeria', 9.0765, 7.3986, 'Africa/Lagos'],
  ['Kano', 'Nigeria', 12.0022, 8.592, 'Africa/Lagos'],
  ['Mogadishu', 'Somalia', 2.0469, 45.3182, 'Africa/Mogadishu'],
  ['Hargeisa', 'Somaliland', 9.56, 44.065, 'Africa/Mogadishu'],
  ['Djibouti', 'Djibouti', 11.5721, 43.1456, 'Africa/Djibouti'],
  ['Addis Ababa', 'Ethiopia', 9.03, 38.74, 'Africa/Addis_Ababa'],
  ['Nairobi', 'Kenya', -1.2921, 36.8219, 'Africa/Nairobi'],
  ['Mombasa', 'Kenya', -4.0435, 39.6682, 'Africa/Nairobi'],
  ['Dar es Salaam', 'Tanzania', -6.7924, 39.2083, 'Africa/Dar_es_Salaam'],
  ['Zanzibar', 'Tanzania', -6.1659, 39.2026, 'Africa/Dar_es_Salaam'],
  ['Kampala', 'Uganda', 0.3476, 32.5825, 'Africa/Kampala'],
  ['Johannesburg', 'South Africa', -26.2041, 28.0473, 'Africa/Johannesburg'],
  ['Cape Town', 'South Africa', -33.9249, 18.4241, 'Africa/Johannesburg'],
  ['Durban', 'South Africa', -29.8587, 31.0218, 'Africa/Johannesburg'],
  ['Karachi', 'Pakistan', 24.8607, 67.0011, 'Asia/Karachi'],
  ['Lahore', 'Pakistan', 31.5204, 74.3587, 'Asia/Karachi'],
  ['Islamabad', 'Pakistan', 33.6844, 73.0479, 'Asia/Karachi'],
  ['Rawalpindi', 'Pakistan', 33.5651, 73.0169, 'Asia/Karachi'],
  ['Peshawar', 'Pakistan', 34.0151, 71.5249, 'Asia/Karachi'],
  ['Faisalabad', 'Pakistan', 31.4504, 73.135, 'Asia/Karachi'],
  ['Multan', 'Pakistan', 30.1575, 71.5249, 'Asia/Karachi'],
  ['Quetta', 'Pakistan', 30.1798, 66.975, 'Asia/Karachi'],
  ['Dhaka', 'Bangladesh', 23.8103, 90.4125, 'Asia/Dhaka'],
  ['Chittagong', 'Bangladesh', 22.3569, 91.7832, 'Asia/Dhaka', 'Chattogram'],
  ['Sylhet', 'Bangladesh', 24.8949, 91.8687, 'Asia/Dhaka'],
  ['Delhi', 'India', 28.6139, 77.209, 'Asia/Kolkata', 'New Delhi'],
  ['Mumbai', 'India', 19.076, 72.8777, 'Asia/Kolkata', 'Bombay'],
  ['Hyderabad', 'India', 17.385, 78.4867, 'Asia/Kolkata'],
  ['Lucknow', 'India', 26.8467, 80.9462, 'Asia/Kolkata'],
  ['Kolkata', 'India', 22.5726, 88.3639, 'Asia/Kolkata', 'Calcutta'],
  ['Bengaluru', 'India', 12.9716, 77.5946, 'Asia/Kolkata', 'Bangalore'],
  ['Chennai', 'India', 13.0827, 80.2707, 'Asia/Kolkata', 'Madras'],
  ['Kozhikode', 'India', 11.2588, 75.7804, 'Asia/Kolkata', 'Calicut'],
  ['Srinagar', 'Kashmir', 34.0837, 74.7973, 'Asia/Kolkata'],
  ['Kabul', 'Afghanistan', 34.5553, 69.2075, 'Asia/Kabul'],
  ['Colombo', 'Sri Lanka', 6.9271, 79.8612, 'Asia/Colombo'],
  ['Malé', 'Maldives', 4.1755, 73.5093, 'Indian/Maldives', 'Male'],
  ['Tashkent', 'Uzbekistan', 41.2995, 69.2401, 'Asia/Tashkent'],
  ['Samarkand', 'Uzbekistan', 39.627, 66.975, 'Asia/Samarkand'],
  ['Bukhara', 'Uzbekistan', 39.7681, 64.4556, 'Asia/Samarkand'],
  ['Almaty', 'Kazakhstan', 43.222, 76.8512, 'Asia/Almaty'],
  ['Bishkek', 'Kyrgyzstan', 42.8746, 74.5698, 'Asia/Bishkek'],
  ['Dushanbe', 'Tajikistan', 38.5598, 68.787, 'Asia/Dushanbe'],
  ['Ashgabat', 'Turkmenistan', 37.9601, 58.3261, 'Asia/Ashgabat'],
  ['Jakarta', 'Indonesia', -6.2088, 106.8456, 'Asia/Jakarta'],
  ['Surabaya', 'Indonesia', -7.2575, 112.7521, 'Asia/Jakarta'],
  ['Bandung', 'Indonesia', -6.9175, 107.6191, 'Asia/Jakarta'],
  ['Medan', 'Indonesia', 3.5952, 98.6722, 'Asia/Jakarta'],
  ['Yogyakarta', 'Indonesia', -7.7956, 110.3695, 'Asia/Jakarta'],
  ['Banda Aceh', 'Indonesia', 5.5483, 95.3238, 'Asia/Jakarta'],
  ['Makassar', 'Indonesia', -5.1477, 119.4327, 'Asia/Makassar'],
  ['Kuala Lumpur', 'Malaysia', 3.139, 101.6869, 'Asia/Kuala_Lumpur'],
  ['George Town', 'Malaysia', 5.4141, 100.3288, 'Asia/Kuala_Lumpur', 'Penang'],
  ['Johor Bahru', 'Malaysia', 1.4927, 103.7414, 'Asia/Kuala_Lumpur'],
  ['Kota Kinabalu', 'Malaysia', 5.9804, 116.0735, 'Asia/Kuching'],
  ['Singapore', 'Singapore', 1.3521, 103.8198, 'Asia/Singapore'],
  ['Bandar Seri Begawan', 'Brunei', 4.9031, 114.9398, 'Asia/Brunei'],
  ['Manila', 'Philippines', 14.5995, 120.9842, 'Asia/Manila'],
  ['Bangkok', 'Thailand', 13.7563, 100.5018, 'Asia/Bangkok'],
  ['Beijing', 'China', 39.9042, 116.4074, 'Asia/Shanghai'],
  ['Urumqi', 'China', 43.8256, 87.6168, 'Asia/Shanghai'],
  ['Hong Kong', 'China', 22.3193, 114.1694, 'Asia/Hong_Kong'],
  ['Tokyo', 'Japan', 35.6762, 139.6503, 'Asia/Tokyo'],
  ['Seoul', 'South Korea', 37.5665, 126.978, 'Asia/Seoul'],
  ['London', 'United Kingdom', 51.5074, -0.1278, 'Europe/London'],
  ['Birmingham', 'United Kingdom', 52.4862, -1.8904, 'Europe/London'],
  ['Manchester', 'United Kingdom', 53.4808, -2.2426, 'Europe/London'],
  ['Bradford', 'United Kingdom', 53.795, -1.7594, 'Europe/London'],
  ['Leicester', 'United Kingdom', 52.6369, -1.1398, 'Europe/London'],
  ['Glasgow', 'United Kingdom', 55.8642, -4.2518, 'Europe/London'],
  ['Dublin', 'Ireland', 53.3498, -6.2603, 'Europe/Dublin'],
  ['Paris', 'France', 48.8566, 2.3522, 'Europe/Paris'],
  ['Marseille', 'France', 43.2965, 5.3698, 'Europe/Paris'],
  ['Lyon', 'France', 45.764, 4.8357, 'Europe/Paris'],
  ['Brussels', 'Belgium', 50.8503, 4.3517, 'Europe/Brussels'],
  ['Amsterdam', 'Netherlands', 52.3676, 4.9041, 'Europe/Amsterdam'],
  ['Rotterdam', 'Netherlands', 51.9244, 4.4777, 'Europe/Amsterdam'],
  ['Berlin', 'Germany', 52.52, 13.405, 'Europe/Berlin'],
  ['Hamburg', 'Germany', 53.5511, 9.9937, 'Europe/Berlin'],
  ['Cologne', 'Germany', 50.9375, 6.9603, 'Europe/Berlin', 'Köln'],
  ['Frankfurt', 'Germany', 50.1109, 8.6821, 'Europe/Berlin'],
  ['Munich', 'Germany', 48.1351, 11.582, 'Europe/Berlin', 'München'],
  ['Vienna', 'Austria', 48.2082, 16.3738, 'Europe/Vienna', 'Wien'],
  ['Zurich', 'Switzerland', 47.3769, 8.5417, 'Europe/Zurich'],
  ['Copenhagen', 'Denmark', 55.6761, 12.5683, 'Europe/Copenhagen'],
  ['Stockholm', 'Sweden', 59.3293, 18.0686, 'Europe/Stockholm'],
  ['Oslo', 'Norway', 59.9139, 10.7522, 'Europe/Oslo'],
  ['Helsinki', 'Finland', 60.1699, 24.9384, 'Europe/Helsinki'],
  ['Madrid', 'Spain', 40.4168, -3.7038, 'Europe/Madrid'],
  ['Barcelona', 'Spain', 41.3874, 2.1686, 'Europe/Madrid'],
  ['Granada', 'Spain', 37.1773, -3.5986, 'Europe/Madrid'],
  ['Lisbon', 'Portugal', 38.7223, -9.1393, 'Europe/Lisbon'],
  ['Rome', 'Italy', 41.9028, 12.4964, 'Europe/Rome'],
  ['Milan', 'Italy', 45.4642, 9.19, 'Europe/Rome'],
  ['Sarajevo', 'Bosnia and Herzegovina', 43.8563, 18.4131, 'Europe/Sarajevo'],
  ['Tirana', 'Albania', 41.3275, 19.8187, 'Europe/Tirane'],
  ['Pristina', 'Kosovo', 42.6629, 21.1655, 'Europe/Belgrade'],
  ['Skopje', 'North Macedonia', 41.9981, 21.4254, 'Europe/Skopje'],
  ['Athens', 'Greece', 37.9838, 23.7275, 'Europe/Athens'],
  ['Moscow', 'Russia', 55.7558, 37.6173, 'Europe/Moscow'],
  ['Kazan', 'Russia', 55.7963, 49.1088, 'Europe/Moscow'],
  ['Grozny', 'Russia', 43.3178, 45.6949, 'Europe/Moscow'],
  ['Makhachkala', 'Russia', 42.9849, 47.5047, 'Europe/Moscow'],
  ['New York', 'United States', 40.7128, -74.006, 'America/New_York', 'NYC'],
  ['Washington, D.C.', 'United States', 38.9072, -77.0369, 'America/New_York', 'DC'],
  ['Philadelphia', 'United States', 39.9526, -75.1652, 'America/New_York'],
  ['Atlanta', 'United States', 33.749, -84.388, 'America/New_York'],
  ['Dearborn', 'United States', 42.3223, -83.1763, 'America/Detroit', 'Detroit'],
  ['Chicago', 'United States', 41.8781, -87.6298, 'America/Chicago'],
  ['Minneapolis', 'United States', 44.9778, -93.265, 'America/Chicago'],
  ['Houston', 'United States', 29.7604, -95.3698, 'America/Chicago'],
  ['Dallas', 'United States', 32.7767, -96.797, 'America/Chicago'],
  ['Phoenix', 'United States', 33.4484, -112.074, 'America/Phoenix'],
  ['Los Angeles', 'United States', 34.0522, -118.2437, 'America/Los_Angeles', 'LA'],
  ['San Francisco', 'United States', 37.7749, -122.4194, 'America/Los_Angeles', 'SF'],
  ['Seattle', 'United States', 47.6062, -122.3321, 'America/Los_Angeles'],
  ['Toronto', 'Canada', 43.6532, -79.3832, 'America/Toronto'],
  ['Mississauga', 'Canada', 43.589, -79.6441, 'America/Toronto'],
  ['Ottawa', 'Canada', 45.4215, -75.6972, 'America/Toronto'],
  ['Montreal', 'Canada', 45.5017, -73.5673, 'America/Toronto', 'Montréal'],
  ['Calgary', 'Canada', 51.0447, -114.0719, 'America/Edmonton'],
  ['Edmonton', 'Canada', 53.5461, -113.4938, 'America/Edmonton'],
  ['Vancouver', 'Canada', 49.2827, -123.1207, 'America/Vancouver'],
  ['Mexico City', 'Mexico', 19.4326, -99.1332, 'America/Mexico_City'],
  ['São Paulo', 'Brazil', -23.5505, -46.6333, 'America/Sao_Paulo', 'Sao Paulo'],
  ['Buenos Aires', 'Argentina', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'],
  ['Port of Spain', 'Trinidad and Tobago', 10.6549, -61.5019, 'America/Port_of_Spain'],
  ['Georgetown', 'Guyana', 6.8013, -58.1551, 'America/Guyana'],
  ['Sydney', 'Australia', -33.8688, 151.2093, 'Australia/Sydney'],
  ['Melbourne', 'Australia', -37.8136, 144.9631, 'Australia/Melbourne'],
  ['Brisbane', 'Australia', -27.4698, 153.0251, 'Australia/Brisbane'],
  ['Perth', 'Australia', -31.9505, 115.8605, 'Australia/Perth'],
  ['Auckland', 'New Zealand', -36.8485, 174.7633, 'Pacific/Auckland'],
];

export const CITIES = RAW.map(([name, country, lat, lng, tz, alias = '']) => ({ name, country, lat, lng, tz, alias }));

const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function searchCities(query, limit = 8) {
  const q = fold(query.trim());
  if (!q) return [];
  const scored = [];
  for (const c of CITIES) {
    const name = fold(c.name);
    const alias = fold(c.alias);
    const country = fold(c.country);
    let score = -1;
    if (name.startsWith(q) || alias.startsWith(q)) score = 0;
    else if (name.includes(q) || alias.includes(q)) score = 1;
    else if (country.startsWith(q)) score = 2;
    if (score >= 0) scored.push([score, c]);
  }
  return scored
    .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
    .slice(0, limit)
    .map(([, c]) => c);
}

// Cities in the device's time zone: a one-tap guess for onboarding.
export const citiesInZone = (tz) => CITIES.filter((c) => c.tz === tz);

export function nearestCity(lat, lng) {
  let best = null;
  let bestD = Infinity;
  const rad = Math.PI / 180;
  for (const c of CITIES) {
    const x = (c.lng - lng) * Math.cos(((c.lat + lat) / 2) * rad);
    const y = c.lat - lat;
    const d = Math.sqrt(x * x + y * y) * 111.2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { city: best, km: bestD };
}
