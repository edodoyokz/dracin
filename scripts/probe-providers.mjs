import 'dotenv/config';

const token = process.env.CAPTAIN_API_TOKEN;

async function probe(name, url) {
    try {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();

        // Captain wraps in { success, data }
        const inner = d.data !== undefined ? d.data : d;

        console.log(`\n=== ${name} ===`);
        console.log(`Status: ${r.status}`);
        console.log(`Outer keys: ${JSON.stringify(Object.keys(d))}`);

        if (Array.isArray(inner)) {
            console.log(`Inner: array[${inner.length}]`);
            if (inner[0]) console.log(`First item keys: ${JSON.stringify(Object.keys(inner[0]).slice(0, 10))}`);
            if (inner[0]) console.log(`First item sample: ${JSON.stringify(inner[0]).substring(0, 300)}`);
        } else if (typeof inner === 'object' && inner !== null) {
            console.log(`Inner keys: ${JSON.stringify(Object.keys(inner))}`);
            for (const k of Object.keys(inner).slice(0, 6)) {
                const v = inner[k];
                if (Array.isArray(v)) {
                    console.log(`  ${k}: array[${v.length}]`);
                    if (v[0]) console.log(`    first keys: ${JSON.stringify(Object.keys(v[0]).slice(0, 8))}`);
                    if (v[0]) console.log(`    sample: ${JSON.stringify(v[0]).substring(0, 200)}`);
                } else {
                    console.log(`  ${k}: ${typeof v} = ${JSON.stringify(v).substring(0, 100)}`);
                }
            }
        } else {
            console.log(`Inner type: ${typeof inner}`);
        }
    } catch (e) {
        console.log(`\n=== ${name} === ERROR: ${e.message}`);
    }
}

// Probe all 5 providers
await probe('goodshort', 'https://captain.sapimu.au/goodshort/api/v1/home');
await probe('reelshort', 'https://captain.sapimu.au/reelshort/api/v1/foryou');
await probe('flextv', 'https://captain.sapimu.au/flextv/api/v1/home');
await probe('cashdrama', 'https://captain.sapimu.au/cashdrama/api/v1/home');
await probe('shortmax', 'https://captain.sapimu.au/shortmax/api/v1/home');

// Also check flextv catalog.json endpoints
console.log('\n=== Checking FlexTV endpoints in catalog ===');
const catalogData = await import('../src/lib/providers/catalog.json', { with: { type: 'json' } });
const flextv = catalogData.default.providers.find(p => p.slug === 'flextv');
if (flextv) {
    console.log('FlexTV endpoints:', flextv.endpoints.map(e => `${e.method} ${e.path}`));
} else {
    console.log('FlexTV not found in catalog');
}
