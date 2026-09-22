// scripts/seed-demo.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import prompts from 'prompts';
import bcrypt from 'bcrypt';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

/**
 * Builds the dataset behind the public demo.
 *
 * The demo exists so that someone can see what the dashboard looks like with
 * real traffic through it without being handed an account on a camera that is
 * watching a real driveway. Everything this script writes is invented: the
 * registrations are drawn from a block the DVLA has never issued, the vehicle
 * details are made up, and the thumbnails are drawn here rather than captured
 * anywhere. No row in the demo database corresponds to a real vehicle or a
 * real person, and that property is the whole point of the file.
 *
 * It is re-run nightly by cron, because the data is anchored to a rolling
 * window ending at the moment it runs. A demo whose most recent detection is
 * three weeks old reads as abandoned rather than as a tool someone maintains.
 */

/*
 * How many rows to write. license_plates holds one row per registration
 * rather than one per sighting (see the note on getPlateHistory in
 * src/lib/data.ts), so this is the size of the fleet the camera has ever
 * seen, not the number of times the gate was crossed.
 */
const TARGET_ROWS = 800;

/** The rolling window the detections are spread across, ending now. */
const WINDOW_DAYS = 90;

/*
 * A floor on how many rows carry a sighting inside the last 24 hours.
 *
 * Both the health strip (api/health counts recent_capture_time within 24
 * hours) and the hourly chart on the admin dashboard read this window. If the
 * random draw happened to leave it nearly empty the demo would look like a
 * pipeline that had stopped, which is precisely the failure the health strip
 * was built to make visible. Rather than leave it to chance, top it up.
 */
const MIN_ROWS_LAST_24H = 18;

/*
 * Fixed so the fleet is stable from one nightly run to the next. The
 * timestamps move with the window, but the plate that was a white Vauxhall
 * van yesterday is still a white Vauxhall van today. Anyone who links someone
 * else to a particular plate's history page should find the same vehicle
 * there an hour later.
 */
const RANDOM_SEED = 0x7570_7400;

/*
 * The demo administrator. Both of these are read from the environment with
 * the same defaults src/lib/demo.ts uses, because the sign-in page prints
 * these credentials to every visitor and the account it names has to be the
 * account this script actually creates. Two copies of the default that could
 * drift apart would produce a demo that publishes a password which does not
 * work.
 */
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'demo@hgm.gg';
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'demo1234';

/** Rows per INSERT. Fourteen columns, so this is well inside Postgres' parameter ceiling. */
const INSERT_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Safety guards
// ---------------------------------------------------------------------------

const force = process.argv.slice(2).some((arg) => arg === '--force' || arg === '-f');

/**
 * Pulls the database name out of a Postgres connection string.
 *
 * Returns null rather than throwing on a malformed URL, because the caller
 * treats "could not work out which database this is" exactly the same as
 * "this is not the demo database": both refuse to continue.
 */
function databaseNameFrom(connectionString: string): string | null {
    try {
        const parsed = new URL(connectionString);
        const name = decodeURIComponent(parsed.pathname).replace(/^\//, '');
        return name.length > 0 ? name : null;
    } catch {
        return null;
    }
}

/*
 * This script deletes every detection it finds before writing its own, so the
 * only real risk it carries is being pointed at the wrong database. Two
 * independent things have to agree that this is the demo before anything is
 * touched, and neither of them can be waved away with --force: an environment
 * that has been deliberately marked as the demo, and a database whose name
 * says so as well. A single flag can be left set in a shell by accident; a
 * flag and a database name are unlikely to be wrong together.
 */
function assertDemoEnvironment(): string {
    if (process.env.DEMO_MODE !== 'true') {
        console.error('\n❌ Refusing to run: DEMO_MODE is not set to "true".');
        console.error('   This script wipes the detections table. It only runs against the public demo.');
        console.error('   Set DEMO_MODE=true in .env.local if this really is the demo environment.');
        process.exit(1);
    }

    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
        console.error('\n❌ Refusing to run: POSTGRES_URL is not set.');
        process.exit(1);
    }

    const databaseName = databaseNameFrom(connectionString);
    if (!databaseName) {
        console.error('\n❌ Refusing to run: could not read a database name out of POSTGRES_URL.');
        console.error('   Expected a connection string of the form postgres://user:pass@host:5432/uniplate_demo');
        process.exit(1);
    }

    if (!databaseName.toLowerCase().includes('demo')) {
        console.error(`\n❌ Refusing to run: the database is "${databaseName}", which is not a demo database.`);
        console.error('   The name must contain "demo". This guard is not skippable with --force.');
        process.exit(1);
    }

    return databaseName;
}

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

/** mulberry32. Small, fast, and good enough for making up cars. */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const random = makeRandom(RANDOM_SEED);

const randomInt = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));

const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

/** Picks from [value, weight] pairs. Weights are relative and need not sum to anything. */
function weightedPick<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let threshold = random() * total;
    for (const [value, weight] of entries) {
        threshold -= weight;
        if (threshold <= 0) return value;
    }
    return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------

/*
 * These registrations are deliberately fake and cannot collide with a real
 * vehicle.
 *
 * A current-style UK plate opens with a two-letter memory tag identifying the
 * DVLA office that issued it, and the first letter of that tag is drawn from
 * a fixed set that has never included Z. Every plate below therefore starts
 * with Z, which makes the whole fleet unissuable by construction while still
 * reading as an ordinary registration at a glance.
 *
 * The age identifier is kept honest, because year_of_manufacture has to agree
 * with it or the vehicle pages look broken to anyone who knows how to read a
 * plate. That is a harmless thing to get right: a valid age identifier on an
 * impossible memory tag is still an impossible plate.
 */
const FAKE_MEMORY_TAG_PREFIX = 'Z';

/** Second letter of the memory tag. I, Q and Z are never used in that position. */
const MEMORY_TAG_SECOND_LETTERS = 'ABCDEFGHJKLMNOPRSTUVWXY';

/** Suffix letters. The DVLA omits I and Q to avoid confusion with 1 and O. */
const SUFFIX_LETTERS = 'ABCDEFGHJKLMNOPRSTUVWXYZ';

/*
 * Suffixes worth skipping. The DVLA withholds combinations that read badly,
 * and a public demo is not the place to discover one by accident.
 */
const SUPPRESSED_SUFFIXES = new Set(['ARS', 'ASS', 'BUM', 'COK', 'FUK', 'GAS', 'JEW', 'NAZ', 'PEE', 'SEX', 'SHT', 'WAN']);

interface Registration {
    plateNumber: string;
    yearOfManufacture: number;
    monthOfFirstRegistration: string;
}

const NOW = new Date();

/**
 * Invents one registration together with the age it implies.
 *
 * The identifier and the year are produced from the same draw rather than
 * picked separately, because the two are not independent: a plate carrying 68
 * is a vehicle first registered between September 2018 and February 2019, and
 * a demo that pairs it with a 2012 build date is a demo that looks wrong to
 * exactly the audience this product is for.
 */
function inventRegistration(taken: Set<string>): Registration {
    for (;;) {
        // Weighted towards the middle of the last decade, which is roughly what
        // the age spread of traffic on a residential road actually looks like.
        const year = weightedPick<number>([
            [2011, 2], [2012, 3], [2013, 4], [2014, 6], [2015, 7], [2016, 8],
            [2017, 9], [2018, 9], [2019, 8], [2020, 6], [2021, 7], [2022, 7],
            [2023, 6], [2024, 5], [2025, 4], [2026, 2],
        ]);

        /*
         * Plates change twice a year: March takes the last two digits of the
         * year, September takes those digits plus fifty. Both halves are
         * possible for a past year, but the current year can only offer the
         * halves that have actually happened yet.
         */
        const isCurrentYear = year === NOW.getFullYear();
        const currentMonth = NOW.getMonth() + 1;
        const secondHalfAvailable = !isCurrentYear || currentMonth >= 9;
        const firstHalfAvailable = !isCurrentYear || currentMonth >= 3;
        if (!firstHalfAvailable && !secondHalfAvailable) continue;

        const useSecondHalf = secondHalfAvailable && (!firstHalfAvailable || random() < 0.5);

        const identifier = useSecondHalf ? (year % 100) + 50 : year % 100;

        /*
         * Registration month is kept inside the same calendar year as the
         * build year. A September plate can legitimately be registered in the
         * January that follows, but allowing that would put the month and the
         * year_of_manufacture column into disagreement for no benefit anyone
         * looking at the demo would notice.
         */
        let month = useSecondHalf ? randomInt(9, 12) : randomInt(3, 8);
        if (isCurrentYear && month > currentMonth) month = currentMonth;

        const suffix =
            pick(SUFFIX_LETTERS.split('')) + pick(SUFFIX_LETTERS.split('')) + pick(SUFFIX_LETTERS.split(''));
        if (SUPPRESSED_SUFFIXES.has(suffix)) continue;

        const plateNumber =
            FAKE_MEMORY_TAG_PREFIX +
            pick(MEMORY_TAG_SECOND_LETTERS.split('')) +
            String(identifier).padStart(2, '0') +
            suffix;

        if (taken.has(plateNumber)) continue;
        taken.add(plateNumber);

        return {
            plateNumber,
            yearOfManufacture: year,
            monthOfFirstRegistration: `${year}-${String(month).padStart(2, '0')}`,
        };
    }
}

// ---------------------------------------------------------------------------
// Vehicle details
// ---------------------------------------------------------------------------

/*
 * Makes and colours are written the way the DVLA returns them, because the
 * table prints these columns verbatim. Getting the casing wrong would not
 * break anything, but it would stop the demo looking like real API output.
 */
const MAKES: readonly (readonly [string, number])[] = [
    ['FORD', 11], ['VAUXHALL', 9], ['VOLKSWAGEN', 9], ['BMW', 8], ['AUDI', 7],
    ['MERCEDES-BENZ', 6], ['TOYOTA', 6], ['NISSAN', 5], ['KIA', 5], ['HYUNDAI', 4],
    ['PEUGEOT', 4], ['RENAULT', 4], ['SKODA', 4], ['MINI', 3], ['LAND ROVER', 3],
    ['HONDA', 3], ['SEAT', 3], ['VOLVO', 2], ['MAZDA', 2], ['CITROEN', 2],
    ['MG', 2], ['TESLA', 2],
];

const COLOURS: readonly (readonly [string, number])[] = [
    ['Black', 19], ['Grey', 17], ['White', 16], ['Blue', 15], ['Silver', 13],
    ['Red', 9], ['Green', 5], ['Orange', 3], ['Yellow', 2], ['Bronze', 1],
];

const FUEL_TYPES: readonly (readonly [string, number])[] = [
    ['PETROL', 50], ['DIESEL', 30], ['HYBRID ELECTRIC', 13], ['ELECTRICITY', 7],
];

/**
 * The statuses the interface actually reacts to.
 *
 * getStatusTone in src/components/app/plate-format.tsx is the authority here.
 * It treats exactly "Valid" and "Taxed" as good news, anything containing
 * "expire" as an alert, and anything containing "sorn" or "untaxed" as a
 * warning. Everything else falls through to the neutral unknown tone, so a
 * status string invented here that does not match one of those tests would
 * quietly render as grey and the demo would never show the alert colours at
 * all.
 *
 * The weights matter as much as the values. The dashboard is built around
 * most vehicles being unremarkable so that the handful that are not stand
 * out; an even spread of statuses would turn the whole table amber and
 * demonstrate the opposite of what the design does.
 */
type DvlaProfile = 'clean' | 'mot-expired' | 'untaxed' | 'sorn' | 'no-record';

const DVLA_PROFILES: readonly (readonly [DvlaProfile, number])[] = [
    ['clean', 68],
    ['mot-expired', 10],
    ['untaxed', 7],
    ['sorn', 7],
    /*
     * Vehicles the DVLA holds nothing for, written as NULL across every
     * vehicle column. The interface renders this state distinctly from a
     * clean lookup on purpose, so that missing information never reads as a
     * clean bill of health, and a demo with no such rows would leave that
     * behaviour undemonstrable.
     */
    ['no-record', 8],
];

/** Days from now, as a date-only string for a DATE column. */
function dateOffset(days: number): string {
    const date = new Date(NOW.getTime() + days * 86_400_000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface VehicleDetails {
    carMake: string | null;
    carColour: string | null;
    fuelType: string | null;
    motStatus: string | null;
    taxStatus: string | null;
    motExpiryDate: string | null;
    taxDueDate: string | null;
}

/**
 * Invents the DVLA half of a row.
 *
 * The expiry dates are derived from the status rather than drawn alongside
 * it, because an "Expired" MOT sitting next to a date eight months in the
 * future is the kind of detail that makes a viewer stop trusting everything
 * else on the page.
 */
function inventVehicleDetails(profile: DvlaProfile): VehicleDetails {
    if (profile === 'no-record') {
        return {
            carMake: null,
            carColour: null,
            fuelType: null,
            motStatus: null,
            taxStatus: null,
            motExpiryDate: null,
            taxDueDate: null,
        };
    }

    const carMake = weightedPick(MAKES);
    const carColour = weightedPick(COLOURS);
    // Teslas are not sold with an engine, and a petrol one in the demo would
    // be noticed immediately.
    const fuelType = carMake === 'TESLA' ? 'ELECTRICITY' : weightedPick(FUEL_TYPES);

    const motExpired = profile === 'mot-expired' || (profile === 'sorn' && random() < 0.7);
    const motStatus = motExpired ? 'Expired' : 'Valid';
    const motExpiryDate = motExpired ? dateOffset(-randomInt(8, 400)) : dateOffset(randomInt(5, 360));

    if (profile === 'sorn') {
        return {
            carMake,
            carColour,
            fuelType,
            motStatus,
            taxStatus: 'SORN',
            motExpiryDate,
            /*
             * No tax due date for a declared-off-road vehicle. There is no
             * outstanding liability to fall due, and inventing one would put
             * the two tax columns into open disagreement.
             */
            taxDueDate: null,
        };
    }

    if (profile === 'untaxed') {
        return {
            carMake,
            carColour,
            fuelType,
            motStatus,
            taxStatus: 'Untaxed',
            motExpiryDate,
            taxDueDate: dateOffset(-randomInt(3, 220)),
        };
    }

    return {
        carMake,
        carColour,
        fuelType,
        motStatus,
        taxStatus: 'Taxed',
        motExpiryDate,
        taxDueDate: dateOffset(randomInt(5, 360)),
    };
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

/*
 * Background tints, keyed by the vehicle colour so that a column of rows is
 * visually distinguishable at 80px wide. A previous demo pointed every row at
 * a single static file, which had two problems: the file did not exist, so
 * every thumbnail was broken, and even had it existed the whole table would
 * have been the same picture repeated eight hundred times.
 */
const COLOUR_TINTS: Record<string, { body: string; roof: string; sky: string }> = {
    Black: { body: '#23272e', roof: '#181b21', sky: '#141a24' },
    Grey: { body: '#5b636e', roof: '#454c56', sky: '#1a2029' },
    White: { body: '#d7dbe0', roof: '#b4bac2', sky: '#1b2430' },
    Blue: { body: '#2b5ea8', roof: '#1e4580', sky: '#121d31' },
    Silver: { body: '#9aa3ad', roof: '#7b848e', sky: '#182029' },
    Red: { body: '#a32f2f', roof: '#7d2222', sky: '#221319' },
    Green: { body: '#2f6b46', roof: '#225034', sky: '#131f1a' },
    Orange: { body: '#bd6a24', roof: '#94511a', sky: '#221a12' },
    Yellow: { body: '#c9a626', roof: '#9c7f19', sky: '#201d12' },
    Bronze: { body: '#8a6a44', roof: '#6b5133', sky: '#1d1913' },
};

/** Used where the DVLA told us nothing, so there is no colour to tint with. */
const UNKNOWN_TINT = { body: '#3a414b', roof: '#2b313a', sky: '#161a21' };

function twoDigits(value: number): string {
    return String(value).padStart(2, '0');
}

/**
 * Draws the capture thumbnail for one detection.
 *
 * image_url holds a base64 data URI in this application rather than a path:
 * the worker stores the thumbnail the camera sent inline, and PlateImage
 * renders it straight into an img src. So a demo thumbnail has to be a data
 * URI too, and pointing the column at a file under /public would be a
 * different shape of value that happens to look similar.
 *
 * Drawn as SVG and encoded here so the script pulls in no image library and
 * needs no assets on disk. Each frame comes out around 1.5KB encoded, which
 * keeps eight hundred of them well under the point where the table's payload
 * becomes the reason the page feels slow.
 */
function drawThumbnail(plateNumber: string, colour: string | null, capturedAt: Date): string {
    const tint = (colour && COLOUR_TINTS[colour]) || UNKNOWN_TINT;

    const stamp =
        `${twoDigits(capturedAt.getDate())}/${twoDigits(capturedAt.getMonth() + 1)}/${capturedAt.getFullYear()} ` +
        `${twoDigits(capturedAt.getHours())}:${twoDigits(capturedAt.getMinutes())}:${twoDigits(capturedAt.getSeconds())}`;

    // Split the way a plate is physically read, and the way formatPlate
    // renders it in the interface.
    const plateText = `${plateNumber.slice(0, 4)} ${plateNumber.slice(4)}`;

    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">' +
        '<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1">' +
        `<stop offset="0" stop-color="#070a0f"/><stop offset="1" stop-color="${tint.sky}"/>` +
        '</linearGradient></defs>' +
        '<rect width="360" height="360" fill="url(#b)"/>' +
        '<rect y="272" width="360" height="88" fill="#0c1016"/>' +
        '<path d="M0 272 L360 272" stroke="#1d242e" stroke-width="2"/>' +
        // Body, roof and glass. A head-on view keeps the plate where a viewer
        // expects to find it on a driveway camera.
        `<rect x="66" y="150" width="228" height="118" rx="20" fill="${tint.body}"/>` +
        `<path d="M104 152 L256 152 L240 104 Q236 96 224 96 L136 96 Q124 96 120 104 Z" fill="${tint.roof}"/>` +
        '<rect x="118" y="106" width="124" height="40" rx="8" fill="#0d141d" opacity="0.88"/>' +
        '<rect x="66" y="196" width="228" height="16" fill="#000000" opacity="0.22"/>' +
        // Headlights, and the wash they throw onto the tarmac.
        '<rect x="82" y="168" width="52" height="20" rx="10" fill="#ffeeb5" opacity="0.92"/>' +
        '<rect x="226" y="168" width="52" height="20" rx="10" fill="#ffeeb5" opacity="0.92"/>' +
        '<ellipse cx="180" cy="286" rx="146" ry="22" fill="#ffeeb5" opacity="0.07"/>' +
        '<rect x="74" y="262" width="34" height="18" rx="4" fill="#0a0d12"/>' +
        '<rect x="252" y="262" width="34" height="18" rx="4" fill="#0a0d12"/>' +
        // The registration itself, on a yellow rear-style plate.
        '<rect x="126" y="222" width="108" height="30" rx="4" fill="#f3c73f"/>' +
        `<text x="180" y="244" text-anchor="middle" font-family="monospace" font-size="17" font-weight="700" fill="#14171c">${plateText}</text>` +
        // Framing marks and an overlay, so it reads as a camera still rather
        // than as clip art.
        '<g stroke="#8ea3bd" stroke-width="2" fill="none" opacity="0.5">' +
        '<path d="M16 34 L16 16 L34 16"/><path d="M326 16 L344 16 L344 34"/>' +
        '<path d="M344 326 L344 344 L326 344"/><path d="M34 344 L16 344 L16 326"/>' +
        '</g>' +
        '<circle cx="28" cy="52" r="5" fill="#e05252"/>' +
        '<text x="42" y="57" font-family="monospace" font-size="13" fill="#c6d2e0">CAM 01 DEMO</text>' +
        `<text x="344" y="57" text-anchor="end" font-family="monospace" font-size="12" fill="#9db0c6">${stamp}</text>` +
        '</svg>';

    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/*
 * The shape of a day on a residential driveway. Two commuter peaks, a quiet
 * middle, and almost nothing between midnight and five.
 *
 * This is worth doing properly. A uniform sprinkle across ninety days is the
 * single most obvious tell that a dataset was generated, and the hourly chart
 * on the admin dashboard exists specifically to show this shape.
 */
const HOUR_WEIGHTS: readonly number[] = [
    0.10, 0.06, 0.05, 0.05, 0.08, 0.25, 0.70, 1.60, 2.10, 1.30, 0.90, 0.85,
    0.95, 0.90, 0.85, 1.20, 1.70, 2.30, 2.00, 1.30, 0.80, 0.55, 0.35, 0.20,
];

/** Sunday first, matching Date#getDay. Weekends are quieter and start later. */
const DAY_WEIGHTS: readonly number[] = [0.55, 1.05, 1.05, 1.05, 1.05, 1.15, 0.70];

/**
 * How much more likely a recent hour is to be the one a row's most recent
 * sighting landed in.
 *
 * This is not an assumption about traffic getting busier. It falls out of the
 * schema: every row keeps only its latest sighting, so a vehicle that passes
 * the camera regularly contributes one row whose recent_capture_time sits
 * near today no matter how long it has been doing so. Sampling uniformly
 * would produce a flat daily chart that no real installation would ever
 * generate.
 */
function recencyWeight(ageInDays: number): number {
    return 1 + 3 * Math.exp(-ageInDays / 21);
}

interface HourBucket {
    start: number;
    weight: number;
}

/** One bucket per hour in the window, weighted by hour, weekday and recency. */
function buildHourBuckets(): HourBucket[] {
    const buckets: HourBucket[] = [];
    const totalHours = WINDOW_DAYS * 24;
    const topOfCurrentHour = new Date(NOW);
    topOfCurrentHour.setMinutes(0, 0, 0);

    for (let hoursAgo = totalHours - 1; hoursAgo >= 0; hoursAgo -= 1) {
        const start = topOfCurrentHour.getTime() - hoursAgo * 3_600_000;
        const at = new Date(start);
        const weight =
            HOUR_WEIGHTS[at.getHours()] * DAY_WEIGHTS[at.getDay()] * recencyWeight(hoursAgo / 24);
        buckets.push({ start, weight });
    }

    return buckets;
}

/** Picks a moment inside a bucket, avoiding the future for the current hour. */
function momentWithin(bucket: HourBucket): number {
    const latest = Math.min(bucket.start + 3_599_000, NOW.getTime() - 60_000);
    if (latest <= bucket.start) return bucket.start;
    return bucket.start + Math.floor(random() * (latest - bucket.start));
}

function sampleSightingTimes(count: number): number[] {
    const buckets = buildHourBuckets();
    const cumulative: number[] = [];
    let running = 0;
    for (const bucket of buckets) {
        running += bucket.weight;
        cumulative.push(running);
    }

    const drawOne = (from: HourBucket[], offsets: number[], total: number): number => {
        const threshold = random() * total;
        let low = 0;
        let high = offsets.length - 1;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (offsets[mid] < threshold) low = mid + 1;
            else high = mid;
        }
        return momentWithin(from[low]);
    };

    const times: number[] = [];
    for (let i = 0; i < count; i += 1) times.push(drawOne(buckets, cumulative, running));

    /*
     * Top up the last 24 hours if the draw came out thin. Rewriting the
     * oldest samples rather than adding new ones keeps the row count exactly
     * where it was asked to be.
     */
    const dayAgo = NOW.getTime() - 86_400_000;
    const recentBuckets = buckets.filter((bucket) => bucket.start >= dayAgo);
    if (recentBuckets.length > 0) {
        const recentOffsets: number[] = [];
        let recentTotal = 0;
        for (const bucket of recentBuckets) {
            recentTotal += bucket.weight;
            recentOffsets.push(recentTotal);
        }

        times.sort((a, b) => a - b);
        let inWindow = times.filter((time) => time >= dayAgo).length;
        for (let i = 0; inWindow < MIN_ROWS_LAST_24H && i < times.length; i += 1) {
            if (times[i] >= dayAgo) break;
            times[i] = drawOne(recentBuckets, recentOffsets, recentTotal);
            inWindow += 1;
        }
    }

    times.sort((a, b) => a - b);

    /*
     * Force the newest sighting to within the last few minutes. The health
     * strip reports the age of the most recent detection, and on a demo that
     * is the first thing anyone looks at: a gap of several hours there reads
     * as an outage rather than as a quiet afternoon.
     */
    times[times.length - 1] = NOW.getTime() - randomInt(2, 9) * 60_000;

    return times;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/*
 * The vehicles that belong here rather than passing through. Fixing their
 * identities keeps them recognisable between nightly runs, which is what
 * makes the repeat-visitor behaviour on a plate's history page worth looking
 * at.
 */
const REGULARS: readonly { make: string; colour: string; fuel: string }[] = [
    { make: 'VAUXHALL', colour: 'White', fuel: 'DIESEL' },   // the parcel van
    { make: 'FORD', colour: 'White', fuel: 'DIESEL' },       // the supermarket delivery
    { make: 'VOLKSWAGEN', colour: 'Blue', fuel: 'PETROL' },  // household car
    { make: 'KIA', colour: 'Grey', fuel: 'HYBRID ELECTRIC' }, // household car
    { make: 'TOYOTA', colour: 'Silver', fuel: 'PETROL' },    // the neighbour
    { make: 'FORD', colour: 'Black', fuel: 'DIESEL' },       // the gardener's pickup
];

interface DetectionRow {
    plateNumber: string;
    captureTime: Date;
    recentCaptureTime: Date;
    imageUrl: string;
    carMake: string | null;
    carColour: string | null;
    fuelType: string | null;
    motStatus: string | null;
    taxStatus: string | null;
    motExpiryDate: string | null;
    taxDueDate: string | null;
    yearOfManufacture: number | null;
    monthOfFirstRegistration: string | null;
}

/**
 * Builds the whole fleet.
 *
 * The two timestamp columns are not interchangeable and the application leans
 * on the difference. capture_time is the first time a registration was ever
 * seen and is never rewritten; recent_capture_time is the latest sighting and
 * is what every chart, filter and health check reads. Their being unequal is
 * the only evidence the schema retains that a vehicle has been back, which is
 * what getAdminStats counts as a repeat visitor. Rows seen once therefore
 * carry the same value twice, and only vehicles that genuinely recur get an
 * earlier first sighting.
 */
function buildRows(): DetectionRow[] {
    const times = sampleSightingTimes(TARGET_ROWS);
    const taken = new Set<string>();
    const windowStart = NOW.getTime() - WINDOW_DAYS * 86_400_000;

    // Newest first, so the demo's front page is the interesting end.
    const orderedTimes = [...times].reverse();

    /*
     * The regulars are pinned to recent sightings, with the parcel van as the
     * very latest detection. A van arriving a few minutes ago is the most
     * ordinary thing a driveway camera could be showing.
     */
    const regularIndices = new Set<number>([0]);
    while (regularIndices.size < REGULARS.length) {
        regularIndices.add(randomInt(1, Math.min(40, orderedTimes.length - 1)));
    }
    const regularSlots = [...regularIndices];

    const rows: DetectionRow[] = [];

    for (let index = 0; index < orderedTimes.length; index += 1) {
        const recentCaptureTime = new Date(orderedTimes[index]);
        const registration = inventRegistration(taken);

        const regularSlot = regularSlots.indexOf(index);
        const isRegular = regularSlot !== -1;

        let details: VehicleDetails;
        if (isRegular) {
            const regular = REGULARS[regularSlot];
            /*
             * Regulars are given clean paperwork. They are the vehicles a
             * visitor is most likely to click into, and a demo that opens on
             * an untaxed van misrepresents what the alert colours are for.
             */
            details = {
                carMake: regular.make,
                carColour: regular.colour,
                fuelType: regular.fuel,
                motStatus: 'Valid',
                taxStatus: 'Taxed',
                motExpiryDate: dateOffset(randomInt(30, 340)),
                taxDueDate: dateOffset(randomInt(20, 330)),
            };
        } else {
            details = inventVehicleDetails(weightedPick(DVLA_PROFILES));
        }

        /*
         * First sighting. A regular has been coming since near the start of
         * the window; a minority of everyone else has been past once before;
         * the rest have been seen exactly once and say so by carrying the
         * same timestamp in both columns.
         */
        let captureTime = recentCaptureTime;
        if (isRegular) {
            captureTime = new Date(windowStart + randomInt(1, 9) * 86_400_000);
        } else if (random() < 0.18) {
            const earlier = recentCaptureTime.getTime() - randomInt(2, 60) * 86_400_000;
            captureTime = new Date(Math.max(earlier, windowStart));
        }

        // A vehicle cannot first be seen after it was last seen.
        if (captureTime.getTime() > recentCaptureTime.getTime()) captureTime = recentCaptureTime;

        const hasDvlaRecord = details.carMake !== null;

        rows.push({
            plateNumber: registration.plateNumber,
            captureTime,
            recentCaptureTime,
            imageUrl: drawThumbnail(registration.plateNumber, details.carColour, recentCaptureTime),
            ...details,
            /*
             * Age is only known from the DVLA lookup, so a row with no record
             * has no year either. Leaving a year behind on an otherwise empty
             * row would put a value into the year filter for a vehicle the
             * table shows as unknown.
             */
            yearOfManufacture: hasDvlaRecord ? registration.yearOfManufacture : null,
            monthOfFirstRegistration: hasDvlaRecord ? registration.monthOfFirstRegistration : null,
        });
    }

    return rows;
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

const INSERT_COLUMNS = [
    'plate_number',
    'capture_time',
    'recent_capture_time',
    'image_url',
    'video_url',
    'car_make',
    'car_color',
    'fuel_type',
    'mot_status',
    'tax_status',
    'mot_expiry_date',
    'tax_due_date',
    'year_of_manufacture',
    'month_of_first_registration',
] as const;

type InsertValue = string | number | Date | null;

function valuesFor(row: DetectionRow): InsertValue[] {
    return [
        row.plateNumber,
        row.captureTime,
        row.recentCaptureTime,
        row.imageUrl,
        /*
         * Always NULL. Video capture is switched off on the demo, so there is
         * no clip on disk behind any of these rows, and the interface already
         * renders the no-video state properly. Writing a video_url anyway
         * would recreate exactly the fault api/health exists to catch: rows
         * claiming a clip that was never recorded, which the health check
         * reads as a broken capture pipeline and reports as an outage.
         */
        null,
        row.carMake,
        row.carColour,
        row.fuelType,
        row.motStatus,
        row.taxStatus,
        row.motExpiryDate,
        row.taxDueDate,
        row.yearOfManufacture,
        row.monthOfFirstRegistration,
    ];
}

async function seedDemo() {
    const databaseName = assertDemoEnvironment();
    console.log(`🧪 Demo mode confirmed. Target database: "${databaseName}".`);

    const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
    const client = await pool.connect();
    console.log('🔗 Connected to the database.');

    try {
        /*
         * Schema first, in its own transaction, so the script works against a
         * database that has never been initialised. These statements are
         * copied verbatim from scripts/init-db.ts and must stay that way: two
         * definitions of the same table that drift apart produce a demo that
         * behaves differently from production for reasons nobody can see.
         */
        await client.query('BEGIN');
        console.log('🚀 Ensuring the schema exists...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS license_plates (
                                                          id SERIAL PRIMARY KEY,
                                                          plate_number VARCHAR(15) NOT NULL,
                capture_time TIMESTAMPTZ NOT NULL,
                recent_capture_time TIMESTAMPTZ NOT NULL,
                image_url TEXT,
                video_url TEXT,
                car_make VARCHAR(50),
                car_color VARCHAR(50),
                fuel_type VARCHAR(50),
                mot_status VARCHAR(50),
                tax_status VARCHAR(50),
                mot_expiry_date DATE,
                tax_due_date DATE,
                year_of_manufacture INT,
                month_of_first_registration VARCHAR(7),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
                );
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_plate_number ON license_plates(plate_number);
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS app_state (
                                                     id INT PRIMARY KEY DEFAULT 1,
                                                     last_plate_update TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                                                       id SERIAL PRIMARY KEY,
                                                       email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS approved_emails (
                                                           id SERIAL PRIMARY KEY,
                                                           email VARCHAR(255) UNIQUE NOT NULL,
                added_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_activity_log (
                                                              id SERIAL PRIMARY KEY,
                                                              timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                actor_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
                action_type VARCHAR(50) NOT NULL,
                target_email VARCHAR(255) NOT NULL,
                details JSONB
                );
        `);

        await client.query('COMMIT');
        console.log('✅ Schema is ready.');

        const existing = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM license_plates');
        const existingRows = Number.parseInt(existing.rows[0]?.count ?? '0', 10);

        /*
         * The only thing --force skips. Cron has nobody to answer the
         * question, and a nightly job that hangs on a prompt is a nightly job
         * that silently stops running.
         */
        if (!force) {
            const answer = await prompts({
                type: 'confirm',
                name: 'proceed',
                message: `This will delete ${existingRows} existing detection${existingRows === 1 ? '' : 's'} from "${databaseName}" and reseed. Continue?`,
                initial: false,
            });

            if (!answer.proceed) {
                console.log('\n⏩ Cancelled. Nothing was changed.');
                return;
            }
        }

        console.log(`🎲 Generating ${TARGET_ROWS} synthetic detections across the last ${WINDOW_DAYS} days...`);
        const rows = buildRows();

        await client.query('BEGIN');

        await client.query('TRUNCATE license_plates RESTART IDENTITY');
        console.log(`🧹 Cleared ${existingRows} previous detection${existingRows === 1 ? '' : 's'}.`);

        const columnList = INSERT_COLUMNS.join(', ');
        for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
            const batch = rows.slice(offset, offset + INSERT_BATCH_SIZE);
            const params: InsertValue[] = [];
            const tuples: string[] = [];

            for (const row of batch) {
                const values = valuesFor(row);
                const placeholders = values.map((_, column) => `$${params.length + column + 1}`);
                tuples.push(`(${placeholders.join(', ')})`);
                params.push(...values);
            }

            await client.query(
                `INSERT INTO license_plates (${columnList}) VALUES ${tuples.join(', ')}`,
                params,
            );
        }
        console.log(`✅ Inserted ${rows.length} detections.`);

        /*
         * The polling client compares this against what it last saw to decide
         * whether new detections have arrived. Leaving it at an old value
         * would have every visitor's first poll announce a batch of new rows
         * that are in fact ninety days old.
         */
        await client.query(`
            INSERT INTO app_state (id, last_plate_update)
            VALUES (1, NOW())
                ON CONFLICT (id) DO UPDATE SET last_plate_update = NOW();
        `);
        console.log('✅ Live-update marker set.');

        // Cost 12, matching the signup route so that a hash written here is
        // indistinguishable from one the application would have produced.
        const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);

        const adminResult = await client.query<{ id: number }>(
            `INSERT INTO admin_users (email, password_hash)
             VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
             RETURNING id`,
            [DEMO_ADMIN_EMAIL, passwordHash],
        );
        const adminId = adminResult.rows[0].id;
        console.log(`✅ Demo admin "${DEMO_ADMIN_EMAIL}" is ready.`);

        /*
         * Seeding approved_emails is a security requirement, not a
         * convenience.
         *
         * src/app/api/admin/auth/signup/route.ts contains a bootstrap path: if
         * approved_emails is empty, the first person to post to the signup
         * endpoint is admitted and made an administrator, whoever they are.
         * That is defensible on a private install behind somebody's own front
         * door and indefensible on a demo anyone on the internet can reach.
         * One row here closes it, so this insert must never be dropped or made
         * conditional.
         */
        await client.query(
            `INSERT INTO approved_emails (email, added_by)
             VALUES ($1, NULL)
             ON CONFLICT (email) DO NOTHING`,
            [DEMO_ADMIN_EMAIL],
        );
        console.log('🔐 Demo admin added to the approved list, closing the bootstrap signup path.');

        /*
         * A couple of audit entries, so the activity tab demonstrates its
         * layout rather than its empty state. Deleted and rewritten each run
         * so nightly runs do not pile up ninety copies of the same two lines.
         */
        const auditTargets = ['ops@hgm.gg', 'contractor@hgm.gg'];
        await client.query('DELETE FROM admin_activity_log WHERE target_email = ANY($1::text[])', [auditTargets]);
        await client.query(
            `INSERT INTO admin_activity_log (timestamp, actor_user_id, action_type, target_email)
             VALUES (NOW() - interval '9 days', $1, 'ADD_ADMIN', $2),
                    (NOW() - interval '2 days', $1, 'REVOKE_ADMIN', $3)`,
            [adminId, auditTargets[0], auditTargets[1]],
        );
        console.log('✅ Audit trail seeded.');

        await client.query('COMMIT');

        const dayAgo = NOW.getTime() - 86_400_000;
        const last24h = rows.filter((row) => row.recentCaptureTime.getTime() >= dayAgo).length;
        const repeats = rows.filter((row) => row.captureTime.getTime() !== row.recentCaptureTime.getTime()).length;
        const withoutDvla = rows.filter((row) => row.carMake === null).length;
        const newest = rows.reduce((latest, row) => Math.max(latest, row.recentCaptureTime.getTime()), 0);
        const newestMinutesAgo = Math.round((NOW.getTime() - newest) / 60_000);

        console.log('\n🎉 Demo data seeded.');
        console.log(`   Detections:        ${rows.length}`);
        console.log(`   Last 24 hours:     ${last24h}`);
        console.log(`   Repeat vehicles:   ${repeats}`);
        console.log(`   No DVLA record:    ${withoutDvla}`);
        console.log(`   Most recent:       ${newestMinutesAgo} minute${newestMinutesAgo === 1 ? '' : 's'} ago`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ An error occurred while seeding, rolling back changes:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Database connection closed.');
    }
}

seedDemo();
