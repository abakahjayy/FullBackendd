const axios = require("axios");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const { GHANA_BBOX, SERVICE_HUBS, isInGhana, serviceInfo, haversineKm } = require("../utils/ghana.js");
const { searchPlaces, placesNear, categoryLabel, normalise } = require("../utils/ghanaPlaces.js");

// Address search / reverse geocoding for the CleanBridge location picker.
// Proxied (instead of the browser calling the geocoder directly) so results
// are limited to Ghana, cached, and the provider can be swapped in one place.
// Providers: Photon (OpenStreetMap data, built for search-as-you-type; good
// for streets and neighbourhoods), with Nominatim as a fallback if Photon is
// down, merged with ~28k Ghanaian businesses and landmarks from Overture Maps
// (utils/ghanaPlaces.js), which OpenStreetMap often lacks.
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

// OSM tags -> a short category label ("Restaurant", "Road", "Area").
const osmCategory = (key, value) => {
    if (!value || value === "yes") return null;
    if (key === "highway") return "Road";
    if (key === "place") return ["city", "town"].includes(value) ? "Town" : "Area";
    if (key === "boundary" || key === "landuse") return null;
    return categoryLabel(value);
};

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
        category: osmCategory(p.osm_key, p.osm_value),
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

// Overture place -> the same shape as the OSM results.
const fromOverture = (p) => {
    const area = p.locality || null;
    const secondary = unique([p.street && normalise(p.street) !== normalise(p.name) ? p.street : null, area, p.region]).join(", ");
    return {
        id: p.id,
        name: p.name,
        label: unique([p.name, secondary]).join(", "),
        secondary,
        area,
        city: area,
        region: p.region || null,
        postcode: null,
        lat: p.lat,
        lng: p.lng,
        category: categoryLabel(p.category),
        phone: p.phone || null,
        website: p.website || null,
        source: "overture",
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
    // Without the user's position, lean towards Accra (where most customers
    // and hubs are) so "Papaye" finds the restaurants, not villages in Oti.
    const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && isInGhana(lat, lng);
    const center = hasPoint ? { lat, lng } : { lat: SERVICE_HUBS[0].lat, lng: SERVICE_HUBS[0].lng };
    const bias = { lat: center.lat.toFixed(2), lon: center.lng.toFixed(2) };

    const osm = await cached(`s:${q.toLowerCase()}:${bias.lat || ""}:${bias.lon || ""}`, async () => {
        try {
            const { data } = await http.get(`${PHOTON}/api/`, {
                params: { q, limit: 8, lang: "en", bbox: bboxParam, ...bias },
            });
            return data.features.filter((f) => f.properties.countrycode === "GH").map((f) => ({ ...fromPhoton(f), source: "osm" }));
        } catch (err) {
            const { data } = await http.get(`${NOMINATIM}/search`, {
                params: { q, format: "jsonv2", addressdetails: 1, countrycodes: "gh", limit: 6 },
            });
            return data.map((r) => ({ ...fromNominatim(r), source: "osm" }));
        }
    }).catch(() => []); // OSM down: the local places still answer

    const places = searchPlaces(q, { near: center, limit: 8 });
    // Order: OSM streets/areas named exactly like the query ("East Legon",
    // "Spintex Road"), then businesses whose name contains it ("papaye" ->
    // the Papaye branches), then the other OSM results, then the rest.
    const phrase = ` ${normalise(q)}`;
    const osmExact = osm.filter((r) => ` ${normalise(r.name)}`.startsWith(phrase)).slice(0, 3);
    const osmOther = osm.filter((r) => !osmExact.includes(r));
    const strong = places.filter((p) => p.nameKey.includes(phrase)).slice(0, 6).map(fromOverture);
    const weak = places.filter((p) => !p.nameKey.includes(phrase)).map(fromOverture);

    // The same place is often in both datasets (and OSM has several features
    // per place): keep one per name within ~150 m.
    const deduped = [];
    for (const r of [...osmExact, ...strong, ...osmOther, ...weak]) {
        const key = normalise(r.name);
        if (deduped.some((k) => normalise(k.name) === key && haversineKm(k, r) < 0.15)) continue;
        if (deduped.some((k) => `${k.name}|${k.secondary}`.toLowerCase() === `${r.name}|${r.secondary}`.toLowerCase())) continue;
        deduped.push(r);
        if (deduped.length === 10) break;
    }

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

    // A named business or landmark right at the pin (within ~40 m) is a better
    // label than the street, e.g. "Batoul Pharmacy, Lagos Avenue".
    const spot = placesNear(lat, lng, { radiusKm: 0.04, limit: 1 })[0];
    let named = place;
    if (spot) {
        const o = fromOverture(spot);
        const secondary = o.secondary || place?.secondary || "";
        named = { ...o, secondary, label: unique([o.name, secondary]).join(", ") };
    }

    // Keep the exact point the user chose, not the geocoder's feature centroid.
    return res.status(StatusCodes.OK).json({
        place: named ? { ...named, lat, lng } : { name: "Pinned location", label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng },
        service: serviceInfo(lat, lng),
    });
};

// =========================
// GET /geo/hubs
// =========================
const hubs = async (req, res) => {
    res.status(StatusCodes.OK).json({ hubs: SERVICE_HUBS });
};

// =========================
// GET /geo/photos?lat=&lng=
// A picture of the place: a satellite snapshot centred on it (always), plus
// real photos taken within ~150 m from Wikimedia Commons (free, no API key)
// when anyone has uploaded some - common for landmarks, malls, churches,
// schools and markets, rarer for small shops.
// =========================
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const stripHtml = (html) => String(html || "").replace(/<[^>]*>/g, "").trim();

const photos = async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new BadRequestError("Please provide lat and lng");

    // Esri World Imagery - the same source as the map's satellite layer.
    const d = 0.0011;
    const satellite = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${lng - d},${lat - d * 0.6},${lng + d},${lat + d * 0.6}&bboxSR=4326&imageSR=3857&size=480,288&format=jpg&f=image`;

    const list = await cached(`p:${lat.toFixed(4)}:${lng.toFixed(4)}`, async () => {
        const { data } = await http.get(COMMONS, {
            params: {
                action: "query", format: "json", generator: "geosearch", ggsnamespace: 6,
                ggscoord: `${lat}|${lng}`, ggsradius: 150, ggslimit: 12,
                prop: "imageinfo|coordinates", iiprop: "url|extmetadata|mime", iiurlwidth: 480,
            },
        });
        return Object.values(data?.query?.pages || {})
            .filter((p) => /^image\/(jpeg|png|webp)$/.test(p.imageinfo?.[0]?.mime || ""))
            .map((p) => {
                const info = p.imageinfo[0];
                const meta = info.extmetadata || {};
                const c = p.coordinates?.[0];
                return {
                    title: stripHtml(meta.ObjectName?.value) || p.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
                    thumb: info.thumburl,
                    page: info.descriptionurl,
                    author: stripHtml(meta.Artist?.value) || null,
                    license: stripHtml(meta.LicenseShortName?.value) || null,
                    km: c ? haversineKm({ lat, lng }, { lat: c.lat, lng: c.lon }) : null,
                };
            })
            .sort((a, b) => (a.km ?? 1) - (b.km ?? 1))
            .slice(0, 6);
    }).catch(() => []);

    return res.status(StatusCodes.OK).json({
        satellite: { url: satellite, credit: "Esri, Maxar, Earthstar Geographics" },
        photos: list,
    });
};

module.exports = { search, reverse, hubs, photos };
