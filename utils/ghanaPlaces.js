const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { haversineKm } = require("./ghana.js");

// Search over ~28k named places in Ghana (shops, churches, schools, hotels,
// fuel stations, banks, offices...) from the Overture Maps Foundation places
// dataset (data/ghana-places.json.gz). OpenStreetMap - what Photon searches -
// misses many Ghanaian businesses that Overture has (mostly from Meta and
// Microsoft), so /geo/search merges both.
//
// Kept in memory (~15 MB): loaded on the first search, no database needed.
// To refresh the data, see the header of scripts/buildGhanaPlaces.js.
// Attribution required: "© Overture Maps Foundation" (shown under the map).

const DATA_FILE = path.join(__dirname, "..", "data", "ghana-places.json.gz");

// Words people type for a category, so "pharmacy near me" or "church" work.
const CATEGORY_WORDS = {
    christian_place_of_worship: "church chapel",
    religious_organization: "church ministry mosque",
    mosque: "mosque",
    place_of_learning: "school",
    elementary_school: "school primary basic",
    high_school: "school shs senior high",
    college_university: "university college campus",
    education: "school education",
    hotel: "hotel lodge guest house",
    lodging: "hotel lodge guest house",
    restaurant: "restaurant food chop bar eatery",
    fast_food_restaurant: "fast food restaurant",
    bar: "bar pub drinking spot",
    gas_station: "fuel filling station petrol",
    hospital: "hospital clinic",
    health_care: "clinic health",
    pharmacy: "pharmacy chemist drug store",
    bank_or_credit_union: "bank",
    financial_service: "bank finance momo",
    atm: "atm cash",
    supermarket: "supermarket shop mall",
    shopping: "shop shopping mall",
    shopping_center: "mall shopping",
    grocery_store: "grocery shop provisions",
    government_office: "government office",
    police_department: "police station",
    automotive_service: "mechanic garage",
    car_dealer: "cars",
    market: "market",
};

const normalise = (s) => String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const categoryLabel = (c) => (c ? c.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase()) : null);

let places = null;
const load = () => {
    if (places) return places;
    try {
        const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(DATA_FILE)).toString("utf8"));
        const f = Object.fromEntries(raw.fields.map((name, i) => [name, i]));
        places = raw.places.map((p) => {
            const place = {
                id: `ovt:${p[f.id]}`,
                name: p[f.name],
                category: p[f.category],
                street: p[f.street],
                locality: p[f.locality],
                region: p[f.region],
                phone: p[f.phone],
                website: p[f.website],
                lat: p[f.lat],
                lng: p[f.lng],
                confidence: p[f.confidence],
            };
            place.nameKey = ` ${normalise(place.name)}`;
            // Leading space so " tok" matches the start of any word.
            place.key = ` ${normalise([place.name, place.street, place.locality, CATEGORY_WORDS[place.category] || categoryLabel(place.category)].join(" "))}`;
            return place;
        });
        console.log(`Ghana places loaded: ${places.length}`);
    } catch (err) {
        console.error("Ghana places data not available:", err.message);
        places = [];
    }
    return places;
};

/**
 * Places whose name/street/area/category start-of-word match every word typed.
 * near: { lat, lng } to prefer close places. Returns best first.
 */
const searchPlaces = (query, { near, limit = 8 } = {}) => {
    const q = normalise(query);
    const tokens = q.split(" ").filter(Boolean);
    if (!tokens.length) return [];
    const all = load();

    const scored = [];
    for (const p of all) {
        if (!tokens.every((t) => p.key.includes(` ${t}`))) continue;
        let score = p.confidence * 10;
        if (p.nameKey.startsWith(` ${q}`)) score += 40;                        // name starts with what was typed
        else if (p.nameKey.includes(` ${q}`)) score += 25;                     // phrase inside the name
        score += tokens.filter((t) => p.nameKey.includes(` ${t}`)).length * 8;   // words found in the name itself
        if (near) {
            const km = haversineKm(near, p);
            score += Math.max(0, 30 - Math.log2(1 + km) * 5);                   // strong pull for places nearby
            scored.push({ p, score, km });
        } else {
            scored.push({ p, score });
        }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(({ p, km }) => ({ ...p, km }));
};

// Named places right around a point (for "what is here?" after dropping a pin).
const placesNear = (lat, lng, { radiusKm = 0.06, limit = 3 } = {}) => {
    const all = load();
    const out = [];
    for (const p of all) {
        if (Math.abs(p.lat - lat) > 0.002 || Math.abs(p.lng - lng) > 0.002) continue;
        const km = haversineKm({ lat, lng }, p);
        if (km <= radiusKm) out.push({ ...p, km });
    }
    return out.sort((a, b) => a.km - b.km).slice(0, limit);
};

module.exports = { searchPlaces, placesNear, categoryLabel, normalise };
