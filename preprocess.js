const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIGURATION
// ============================================================

const DATASET_DIR = "./POP909";

// Output file
const OUTPUT_FILE = "./pop909_chord_sequences.json";

// ============================================================
// READ CHORD FILE
// ============================================================

function readChordFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");

    const lines = content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const chords = [];

    for (const line of lines) {

        // Expected format:
        // start_time end_time chord
        //
        // Example:
        // 0.000 0.500 C:maj
        // 0.500 1.000 F:maj
        // 1.000 1.500 N

        const fields = line.split(/\s+/);

        if (fields.length < 3) {
            continue;
        }

        const chord = fields[2];

        // Ignore N / X (no chord)
        if (chord === "N" || chord === "X") {
            continue;
        }

        chords.push(chord);
    }

    return chords;
}

// ============================================================
// READ KEY FILE
// ============================================================

function readKeyFile(filePath) {

    if (!fs.existsSync(filePath)) {
        console.warn(`Key file not found: ${filePath}`);
        return [];
    }

    const content = fs.readFileSync(filePath, "utf8");

    const lines = content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const keys = [];

    for (const line of lines) {

        // Expected format:
        // start_time end_time key
        //
        // Example:
        // 0.000 191.982 Gb:maj

        const fields = line.split(/\s+/);

        if (fields.length < 3) {
            continue;
        }

        const startTime = parseFloat(fields[0]);
        const endTime = parseFloat(fields[1]);
        const key = fields[2];

        keys.push({
            startTime,
            endTime,
            key
        });
    }

    return keys;
}

// ============================================================
// FIND ALL CHORD FILES
// ============================================================

function findChordFiles(directory) {

    let files = [];

    const entries = fs.readdirSync(directory, {
        withFileTypes: true
    });

    for (const entry of entries) {

        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {

            files = files.concat(
                findChordFiles(fullPath)
            );

        } else if (
            entry.isFile() &&
            entry.name.toLowerCase() === "chord_audio.txt"
        ) {

            files.push(fullPath);
        }
    }

    return files;
}

// ============================================================
// PROCESS DATASET
// ============================================================

function processDataset() {

    if (!fs.existsSync(DATASET_DIR)) {
        console.error(
            `Dataset directory does not exist: ${DATASET_DIR}`
        );
        process.exit(1);
    }

    const files = findChordFiles(DATASET_DIR);

    console.log(`Found ${files.length} chord files.\n`);

    const songs = [];

    for (const filePath of files) {

        try {

            // ----------------------------------------------------
            // READ CHORDS
            // ----------------------------------------------------

            const chords = readChordFile(filePath);

            // ----------------------------------------------------
            // GET SONG DIRECTORY
            // ----------------------------------------------------

            const songDirectory = path.dirname(filePath);

            // Example:
            // ./POP909/001/chord_audio.txt
            //
            // songId = 001

            const songId = path.basename(songDirectory);

            // ----------------------------------------------------
            // READ KEY
            // ----------------------------------------------------

            const keyFilePath = path.join(
                songDirectory,
                "key_audio.txt"
            );

            const keys = readKeyFile(keyFilePath);

            // ----------------------------------------------------
            // SAVE SONG
            // ----------------------------------------------------

            songs.push({
                songId,
                key: keys,
                chords
            });

            console.log(
                `${songId}: ${keys.length} key segments, ${chords.length} chords`
            );

        } catch (error) {

            console.error(
                `Error processing ${filePath}:`,
                error.message
            );
        }
    }

    // ============================================================
    // SAVE RESULTS
    // ============================================================

    fs.writeFileSync(
        OUTPUT_FILE,
        JSON.stringify(songs, null, 2),
        "utf8"
    );

    console.log(
        `\nProcessed ${songs.length} songs.`
    );

    console.log(
        `Saved to: ${OUTPUT_FILE}`
    );
}

// ============================================================
// RUN
// ============================================================

//processDataset();