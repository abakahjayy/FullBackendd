// Rebuilds data/ghana-places.json.gz (used by utils/ghanaPlaces.js) from the
// Overture Maps Foundation places dataset - free, openly licensed, no account.
//
//   npm i --no-save @duckdb/node-api
//   node scripts/buildGhanaPlaces.js 2026-09-23.0      (a release name from
//     https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&prefix=release/&delimiter=/)
//
// DuckDB reads only the Ghana part of the public parquet files (~20 s).
// Keeps places in Ghana with confidence >= 0.4. Commit the new .gz file.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { DuckDBInstance } = require("@duckdb/node-api");

const release = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release || "")) {
    console.error("Usage: node scripts/buildGhanaPlaces.js <overture release, e.g. 2026-09-23.0>");
    process.exit(1);
}

const REGIONS = {
    AA: "Greater Accra", AH: "Ashanti", BA: "Bono", BE: "Bono East", AF: "Ahafo", CP: "Central", EP: "Eastern",
    NP: "Northern", NE: "North East", SV: "Savannah", UE: "Upper East", UW: "Upper West", TV: "Volta", OT: "Oti",
    WP: "Western", WN: "Western North",
};
const round = (x, dp) => Math.round(x * 10 ** dp) / 10 ** dp;

(async () => {
    const db = await DuckDBInstance.create();
    const c = await db.connect();
    await c.run("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';");
    const res = await c.runAndReadAll(`
        select id, names.primary as name, coalesce(basic_category, taxonomy.primary) as category,
               confidence, operating_status as status,
               addresses[1].freeform as street, addresses[1].locality as locality,
               addresses[1].region as region, addresses[1].country as country,
               websites[1] as website, phones[1] as phone,
               (bbox.xmin + bbox.xmax) / 2 as lng, (bbox.ymin + bbox.ymax) / 2 as lat
        from read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*', hive_partitioning=1)
        where bbox.xmin between -3.3 and 1.3 and bbox.ymin between 4.5 and 11.2
          and names.primary is not null`);
    const cols = res.columnNames();
    const rows = res.getRows().map((r) => Object.fromEntries(r.map((v, i) => [cols[i], v])));

    const places = rows
        .filter((r) => r.country === "GH" && r.confidence >= 0.4 && r.status !== "permanently_closed" && r.name.trim().length > 1)
        .map((r) => [
            r.id, r.name.trim(), r.category || null, (r.street || "").trim() || null, r.locality || null,
            REGIONS[r.region] || r.region || null, r.phone || null, r.website || null,
            round(r.lat, 5), round(r.lng, 5), round(r.confidence, 2),
        ]);

    const out = {
        source: `Overture Maps Foundation places, release ${release}`,
        license: "CDLA-Permissive-2.0 / Apache-2.0 / CC0 (per source) - attribution: © Overture Maps Foundation",
        version: `${release}-c40`,
        fields: ["id", "name", "category", "street", "locality", "region", "phone", "website", "lat", "lng", "confidence"],
        places,
    };
    const file = path.join(__dirname, "..", "data", "ghana-places.json.gz");
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(out), { level: 9 }));
    console.log(`Wrote ${places.length} places to data/ghana-places.json.gz (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
})().catch((err) => { console.error(err.message); process.exit(1); });
