// Ghana reference data + helpers for the CleanBridge GH app.

// The 16 administrative regions (2019 re-demarcation).
const REGIONS = [
    "Greater Accra", "Ashanti", "Western", "Western North", "Central", "Eastern",
    "Volta", "Oti", "Northern", "Savannah", "North East", "Upper East", "Upper West",
    "Bono", "Bono East", "Ahafo",
];

// CleanBridge service hubs (depots). A location is serviceable if it is within
// `radiusKm` (straight line) of at least one hub; the pickup's distance fee is
// charged on the road distance from the nearest hub.
const SERVICE_HUBS = [
    { id: "accra-central", name: "Accra Central", region: "Greater Accra", lat: 5.5600, lng: -0.2057, radiusKm: 20 },
    { id: "madina", name: "Madina / Adenta", region: "Greater Accra", lat: 5.6690, lng: -0.1650, radiusKm: 15 },
    { id: "tema", name: "Tema", region: "Greater Accra", lat: 5.6698, lng: -0.0166, radiusKm: 20 },
    { id: "kasoa", name: "Kasoa", region: "Central", lat: 5.5342, lng: -0.4244, radiusKm: 15 },
    { id: "kumasi", name: "Kumasi", region: "Ashanti", lat: 6.6885, lng: -1.6244, radiusKm: 25 },
    { id: "takoradi", name: "Sekondi-Takoradi", region: "Western", lat: 4.8990, lng: -1.7600, radiusKm: 20 },
    { id: "cape-coast", name: "Cape Coast", region: "Central", lat: 5.1053, lng: -1.2466, radiusKm: 15 },
    { id: "koforidua", name: "Koforidua", region: "Eastern", lat: 6.0941, lng: -0.2591, radiusKm: 15 },
    { id: "ho", name: "Ho", region: "Volta", lat: 6.6008, lng: 0.4713, radiusKm: 15 },
    { id: "sunyani", name: "Sunyani", region: "Bono", lat: 7.3349, lng: -2.3123, radiusKm: 15 },
    { id: "tamale", name: "Tamale", region: "Northern", lat: 9.4034, lng: -0.8424, radiusKm: 20 },
];

// Rough bounding box of Ghana, used to bias/limit geocoding and reject
// coordinates that are obviously outside the country.
const GHANA_BBOX = { minLat: 4.5, maxLat: 11.2, minLng: -3.3, maxLng: 1.3 };

// Straight-line distance understates real road distance; ~1.35 is a common
// urban detour factor.
const ROAD_FACTOR = 1.35;

// Mobile network prefixes (the 3 digits after the leading 0).
const NETWORK_PREFIXES = {
    MTN: ["024", "025", "053", "054", "055", "059"],
    Telecel: ["020", "050"],
    AirtelTigo: ["026", "027", "056", "057"],
};

const WASTE_TYPES = [
    "Household mix", "Recyclables", "Organic / food waste", "Garden waste",
    "Bulky items", "E-waste", "Construction debris", "Large waste bin",
];

const VEHICLE_TYPES = [
    "Motor tricycle (Aboboyaa)", "Mini truck", "Light truck", "Tipper truck", "Compactor truck",
];

// What each vehicle type is good for. capacityBags is a rough guide for a
// standard 50 L bag; used to recommend a vehicle and warn when a load is big.
const VEHICLE_INFO = {
    "Motor tricycle (Aboboyaa)": { capacityBags: 8, description: "Small household loads on narrow streets" },
    "Mini truck": { capacityBags: 20, description: "Most household and small shop pickups" },
    "Light truck": { capacityBags: 45, description: "Large households, compounds and bulky items" },
    "Tipper truck": { capacityBags: 120, description: "Construction debris and heavy loads" },
    "Compactor truck": { capacityBags: 300, description: "Estates, markets and big events" },
};

// Smallest suitable vehicle for the load.
const recommendVehicle = (wasteType, bags) => {
    if (wasteType === "Construction debris") return "Tipper truck";
    const minimum = ["Bulky items", "E-waste", "Large waste bin"].includes(wasteType) ? "Mini truck" : null;
    const types = Object.keys(VEHICLE_INFO);
    const start = minimum ? types.indexOf(minimum) : 0;
    return types.slice(start).find((t) => VEHICLE_INFO[t].capacityBags >= Number(bags || 1)) || "Compactor truck";
};

// Ghana DVLA plates, e.g. "GR 1234-21", "AS 567-19", "GT 4821 X".
const VEHICLE_REG_REGEX = /^[A-Z]{2}[\s-]?\d{1,4}[\s-]?(\d{2}|[A-Z])$/;

// GhanaPost GPS digital address, e.g. "GA-183-8164", "AK-0039-5028".
const GHANA_POST_GPS_REGEX = /^[A-Z]{2}-\d{3,4}-\d{4}$/;

// Accepts 024 123 4567, 0241234567, 233241234567, +233 24 123 4567 ...
// Returns "+233241234567" or null if it isn't a valid Ghana mobile number.
const normalizeGhanaPhone = (input) => {
    if (!input) return null;
    let digits = String(input).replace(/[^\d+]/g, "");
    if (digits.startsWith("+233")) digits = `0${digits.slice(4)}`;
    else if (digits.startsWith("233") && digits.length === 12) digits = `0${digits.slice(3)}`;
    if (!/^0\d{9}$/.test(digits)) return null;
    if (!detectNetwork(digits)) return null;
    return `+233${digits.slice(1)}`;
};

const detectNetwork = (phone) => {
    if (!phone) return null;
    let local = String(phone).replace(/[^\d+]/g, "");
    if (local.startsWith("+233")) local = `0${local.slice(4)}`;
    const prefix = local.slice(0, 3);
    return Object.keys(NETWORK_PREFIXES).find((n) => NETWORK_PREFIXES[n].includes(prefix)) || null;
};

const normalizeGhanaPostGps = (input) => {
    if (!input) return null;
    const value = String(input).trim().toUpperCase().replace(/\s+/g, "-");
    return GHANA_POST_GPS_REGEX.test(value) ? value : undefined; // undefined = invalid
};

const isInGhana = (lat, lng) =>
    lat >= GHANA_BBOX.minLat && lat <= GHANA_BBOX.maxLat && lng >= GHANA_BBOX.minLng && lng <= GHANA_BBOX.maxLng;

const toRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (a, b) => {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

// Nearest hub + estimated road distance, and whether we serve that spot.
const serviceInfo = (lat, lng) => {
    const point = { lat: Number(lat), lng: Number(lng) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || !isInGhana(point.lat, point.lng)) {
        return { serviceable: false, reason: "Location is outside Ghana", hub: null, distanceKm: null };
    }
    let best = null;
    SERVICE_HUBS.forEach((hub) => {
        const km = haversineKm(point, hub);
        if (!best || km < best.km) best = { hub, km };
    });
    const serviceable = best.km <= best.hub.radiusKm;
    return {
        serviceable,
        reason: serviceable ? null : `We don't collect here yet - nearest hub is ${best.hub.name}, ${best.km.toFixed(1)} km away`,
        hub: { id: best.hub.id, name: best.hub.name, region: best.hub.region },
        distanceKm: Math.round(best.km * ROAD_FACTOR * 10) / 10,
    };
};

module.exports = {
    REGIONS,
    SERVICE_HUBS,
    GHANA_BBOX,
    ROAD_FACTOR,
    NETWORK_PREFIXES,
    WASTE_TYPES,
    VEHICLE_TYPES,
    VEHICLE_INFO,
    recommendVehicle,
    VEHICLE_REG_REGEX,
    GHANA_POST_GPS_REGEX,
    normalizeGhanaPhone,
    detectNetwork,
    normalizeGhanaPostGps,
    isInGhana,
    haversineKm,
    serviceInfo,
};
