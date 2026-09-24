const axios = require("axios");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const { GHANA_BBOX, SERVICE_HUBS, isInGhana, serviceInfo } = require("../utils/ghana.js");

// Address search / reverse geocoding for the CleanBridge location picker.
// Proxied (instead of the browser calling the geocoder directly) so results
// are limited to Ghana, cached, and the provider can be swapped in one place.
// Provider: Photon (OpenStreetMap data, built for search-as-you-type), with
// Nominatim as a fallback if Photon is down.
const PHOTON = "https://photon.komoot.io";
const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "CleanBridgeGH/1.0 (waste collection app)";
const http = axios.create({ timeout: 6000, headers: { "User-Agent": USER_AGENT } });

// Tiny TTL cache - search-as-you-type repeats the same prefixes a lot.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 1000;
const cache = new Map();
const cached = async (key, fn) => {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = await fn();
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
    return value;
};

const bboxParam = `${GHANA_BBOX.minLng},${GHANA_BBOX.minLat},${GHANA_BBOX.maxLng},${GHANA_BBOX.maxLat}`;

const unique = (parts) => [...new Set(parts.filter(Boolean))];

// Photon feature -> the shape the frontend uses everywhere.
const fromPhoton = (f) => {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    const street = p.street ? `${p.housenumber ? `${p.housenumber} ` : ""}${p.street}` : null;
    const area = p.district || p.locality || p.city || p.county || p.name;
    const city = p.city || p.county || null;
    const region = p.state ? p.state.replace(/ Region$/, "") : null;
    const name = p.name || street || area;
    return {
        id: `${p.osm_type}${p.osm_id}`,
        name,
        label: unique([name, street !== name ? street : null, area !== name ? area : null, city !== area ? city : null, region]).join(", "),
        secondary: unique([area !== name ? area : null, city !== area ? city : null, region]).join(", "),
        area,
        city,
        region,
        postcode: p.postcode || null,
        lat,
        lng,
    };
};

const fromNominatim = (r) => {
    const a = r.address || {};
    const area = a.suburb || a.neighbourhood || a.city_district || a.town || a.city || a.village || a.county;
    const city = a.city || a.town || a.municipality || a.county || null;
    const region = a.state ? a.state.replace(/ Region$/, "") : null;
    const name = r.name || a.road || area;
    return {
        id: `${r.osm_type}${r.osm_id}`,
        name,
        label: r.display_name?.replace(/, Ghana$/, ""),
        secondary: unique([area !== name ? area : null, city !== area ? city : null, region]).join(", "),
        area,
        city,
        region,
        postcode: a.postcode || null,
        lat: Number(r.lat),
        lng: Number(r.lon),
    };
};

// =========================
// GET /geo/search?q=&lat=&lng=   (lat/lng optional: bias results near the user)
// =========================
const search = async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.status(StatusCodes.OK).json({ results: [] });
    if (q.length > 120) throw new BadRequestError("Search text is too long");

    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const bias = Number.isFinite(lat) && Number.isFinite(lng) && isInGhana(lat, lng)
        ? { lat: lat.toFixed(2), lon: lng.toFixed(2) } : {};

    const results = await cached(`s:${q.toLowerCase()}:${bias.lat || ""}:${bias.lon || ""}`, async () => {
        try {
            const { data } = await http.get(`${PHOTON}/api/`, {
                params: { q, limit: 8, lang: "en", bbox: bboxParam, ...bias },
            });
            return data.features.filter((f) => f.properties.countrycode === "GH").map(fromPhoton);
        } catch (err) {
            const { data } = await http.get(`${NOMINATIM}/search`, {
                params: { q, format: "jsonv2", addressdetails: 1, countrycodes: "gh", limit: 6 },
            });
            return data.map(fromNominatim);
        }
    });

    // OSM often has several features for one place (building, shop, node);
    // show each name + locality once.
    const seen = new Set();
    const deduped = results.filter((r) => {
        const key = `${r.name}|${r.secondary}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return res.status(StatusCodes.OK).json({
        results: deduped.map((r) => ({ ...r, service: serviceInfo(r.lat, r.lng) })),
    });
};

// =========================
// GET /geo/reverse?lat=&lng=
// =========================
const reverse = async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new BadRequestError("Please provide lat and lng");
    }
    if (!isInGhana(lat, lng)) {
        return res.status(StatusCodes.OK).json({
            place: null,
            service: serviceInfo(lat, lng),
        });
    }

    // ~11 m precision is plenty for a gate and makes the cache effective.
    const key = `r:${lat.toFixed(4)}:${lng.toFixed(4)}`;
    const place = await cached(key, async () => {
        try {
            const { data } = await http.get(`${PHOTON}/reverse`, { params: { lat, lon: lng, lang: "en", limit: 1 } });
            return data.features[0] ? fromPhoton(data.features[0]) : null;
        } catch (err) {
            const { data } = await http.get(`${NOMINATIM}/reverse`, {
                params: { lat, lon: lng, format: "jsonv2", addressdetails: 1, zoom: 18 },
            });
            return data && !data.error ? fromNominatim(data) : null;
        }
    });

    // Keep the exact point the user chose, not the geocoder's feature centroid.
    return res.status(StatusCodes.OK).json({
        place: place ? { ...place, lat, lng } : { name: "Pinned location", label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng },
        service: serviceInfo(lat, lng),
    });
};

// =========================
// GET /geo/hubs
// =========================
const hubs = async (req, res) => {
    res.status(StatusCodes.OK).json({ hubs: SERVICE_HUBS });
};

module.exports = { search, reverse, hubs };
