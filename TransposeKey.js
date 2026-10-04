
// TRANSPOSITION TO C MAJOR


const NOTE_TO_SEMITONE = {
    "C": 0,

    "C#": 1,
    "Db": 1,

    "D": 2,

    "D#": 3,
    "Eb": 3,

    "E": 4,
    "Fb": 4,

    "F": 5,

    "F#": 6,
    "Gb": 6,

    "G": 7,

    "G#": 8,
    "Ab": 8,

    "A": 9,

    "A#": 10,
    "Bb": 10,

    "B": 11,
    "Cb": 11
};


// ============================================================
// SEMITONE -> NOTE
// ============================================================
//
// We use sharps for the normalized representation.


const SEMITONE_TO_NOTE = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B"
];



//
// JavaScript's % can return negative numbers.
//
// Example:
// -1 % 12 = -1
//
// We want:
// -1 -> 11
//
// Therefore we use:
// ((n % 12) + 12) % 12
//
// ============================================================

function mod12(n) {
    return ((n % 12) + 12) % 12;
}


// ============================================================
// PARSE CHORD
// ============================================================
//
// Examples:
//
// "C:maj"
// "A:min"
// "F#:maj7"
// "Bb:min7"
// "D:sus4"
// "G:sus2"
// "B:hdim"
//
// Returns:
//
// {
//     root: "C",
//     quality: "maj"
// }
//
// ============================================================

function parseChord(chord) {

    // Remove inversion/bass information
    // Example:
    // C:min/5 -> C:min
    // G:7/3   -> G:7

    const chordWithoutBass = chord.split("/")[0];

    const parts = chordWithoutBass.split(":");

    const root = parts[0];

    const quality = parts[1] || "maj";

    return {
        root,
        quality
    };
}


// ============================================================
// SIMPLIFY CHORD QUALITY
// ============================================================
//
// maj7 -> maj
// min7 -> min
// sus4 -> sus
// sus2 -> sus
// hdim -> dim
//
// Everything else remains unchanged.
//
// ============================================================

function simplifyQuality(quality) {

    // --------------------------------------------------------
    // Remove spaces
    // --------------------------------------------------------

    quality = quality.trim();


    // --------------------------------------------------------
    // Normalize common notation
    // --------------------------------------------------------

    quality = quality
        .replace(/\s+/g, "")
        .toLowerCase();


    // --------------------------------------------------------
    // MAJOR
    // --------------------------------------------------------
    //
    // maj
    // maj7
    // maj9
    // maj(9)
    // maj(7)
    // major
    //
    // All become:
    // maj
    //
    // --------------------------------------------------------

    if (
       
        quality.startsWith("maj")
    ) {
        return "maj";
    }


    // --------------------------------------------------------
    // MINOR
    // --------------------------------------------------------
    //
    // min
    // min7
    // min9
    // min(9)
    // minor
    //
    // All become:
    // min
    //
    // --------------------------------------------------------

    if (
        
        quality.startsWith("min")
    ) {
        return "min";
    }


    // --------------------------------------------------------
    // DOMINANT SEVENTH
    // --------------------------------------------------------
    //
    // 7
    // 9
    // 11
    // 13
    //
    // Keep these as dominant chords.
    //
    // Example:
    // G:7 -> G:dom7
    //
    // --------------------------------------------------------

    if (
        quality.startsWith("7") ||
        quality.startsWith("9") ||
        quality.startsWith("11") ||
        quality.startsWith("13") ||
        /^7\(\d+\)$/.test(quality)
    ) {
        return "dom7";
    }


    // --------------------------------------------------------
    // SUSPENDED
    // --------------------------------------------------------
    //
    // sus
    // sus2
    // sus4
    //
    // All become:
    // sus
    //
    // --------------------------------------------------------

    if (
       
        quality.startsWith("sus")
    ) {
        return "sus";
    }


    // --------------------------------------------------------
    // DIMINISHED
    // --------------------------------------------------------
    //
    // dim
    // dim7
    // hdim
    // hdim7
    //
    // All become:
    // dim
    //
    // --------------------------------------------------------

    if (
        quality === "dim" ||
        quality === "dim7" ||
        quality === "hdim" ||
        quality === "hdim7"
    ) {
        return "dim";
    }


    // --------------------------------------------------------
    // AUGMENTED
    // --------------------------------------------------------

    if (
        quality.startsWith("aug") ||
        quality === "+"
    ) {
        return "aug";
    }


    // --------------------------------------------------------
    // UNKNOWN
    // --------------------------------------------------------
    //
    // Keep the original quality rather than silently
    // destroying information.
    //
    // --------------------------------------------------------

    return quality;
}

// ============================================================
// GET KEY ROOT
// ============================================================
//
// Examples:
//
// "C:maj" -> C
// "A:min" -> A
// "Gb:maj" -> Gb
//
// ============================================================

function getKeyRoot(key) {

    const parts = key.split(":");

    return parts[0];
}


// ============================================================
// GET KEY QUALITY
// ============================================================
//
// Examples:
//
// "C:maj" -> maj
// "A:min" -> min
//
// ============================================================

function getKeyQuality(key) {

    const parts = key.split(":");

    return parts[1] || "maj";
}


// ============================================================
// FIND TRANSPOSITION INTERVAL
// ============================================================
//
// We want to move the ORIGINAL TONIC to C.
//
// C = 0
//
// Example 1:
// Original key = G:maj
//
// G = 7
// C = 0
//
// transpose = 0 - 7
// transpose = -7
//
//
//
// Example 2:
// Original key = A:min
//
// A = 9
// C = 0
//
// transpose = 0 - 9
// transpose = -9
//
// Using mod12:
//
// -9 -> 3
//
// Therefore every note moves +3 semitones.
//
// A -> C
//
//
//
// Example 3:
// Original key = Gb:maj
//
// Gb = 6
//
// transpose = 0 - 6
// transpose = -6
//
// mod12(-6) = 6
//
// Gb -> C
//
// ============================================================

function getTransposeAmount(originalKey) {

    const keyRoot = getKeyRoot(originalKey);

    const keySemitone = NOTE_TO_SEMITONE[keyRoot];

    if (keySemitone === undefined) {
        throw new Error(
            `Unknown key/root note: ${keyRoot}`
        );
    }

    return mod12(0 - keySemitone);
}


// ============================================================
// TRANSPOSE NOTE
// ============================================================
//
// Example:
//
// transposeNote("A", 3)
//
// A = 9
// 9 + 3 = 12
// 12 mod 12 = 0
// 0 = C
//
// Result:
// C
//
// ============================================================

function transposeNote(note, transposeAmount) {

    const semitone = NOTE_TO_SEMITONE[note];

    if (semitone === undefined) {
        throw new Error(
            `Unknown note: ${note}`
        );
    }

    const newSemitone = mod12(
        semitone + transposeAmount
    );

    return SEMITONE_TO_NOTE[newSemitone];
}


// ============================================================
// TRANSPOSE CHORD
// ============================================================
//
// Example:
//
// transposeChord("A:min", 3)
//
// A -> C
// min -> min
//
// Result:
// C:min
//
// ============================================================

function transposeChord(chord, transposeAmount) {

    const {
        root,
        quality
    } = parseChord(chord);

    const newRoot = transposeNote(
        root,
        transposeAmount
    );

    const newQuality = simplifyQuality(
        quality
    );

    return `${newRoot}:${newQuality}`;
}


// ============================================================
// TRANSPOSE KEY
// ============================================================
//
// We force the resulting key to C:maj.
//
// This is important because:
//
// A:min and C:maj are relative keys.
//
// The user specifically wants EVERYTHING represented
// relative to C:maj.
//
// Therefore:
//
// A:min -> C:maj
//
// rather than:
//
// A:min -> C:min
//
// ============================================================

function transposeKey() {

    return "C:maj";
}


// ============================================================
// MAIN FUNCTION
// ============================================================
//
// The ONLY argument is:
//
// songs
//
// Example:
//
// const result = transposeSongsToCMajor(songs);
//
// ============================================================

function transposeSongsToCMajor(songs) {

    if (!Array.isArray(songs)) {
        throw new Error(
            "Input must be an array of songs."
        );
    }

    const transformedSongs = [];

    for (const song of songs) {

        if (!song.key || !Array.isArray(song.key)) {
            throw new Error(
                `Song ${song.songId} does not contain valid key information.`
            );
        }

        if (!Array.isArray(song.chords)) {
            throw new Error(
                `Song ${song.songId} does not contain a valid chords array.`
            );
        }

        // --------------------------------------------------------
        // Use the FIRST key segment to determine the tonic.
        // --------------------------------------------------------
        //
        // For example:
        //
        // key = [
        //     {
        //         startTime: 0,
        //         endTime: 191,
        //         key: "Gb:maj"
        //     }
        // ]
        //
        // Original key = Gb:maj
        //
        // --------------------------------------------------------

        const originalKey = song.key[0].key;

        const transposeAmount =
            getTransposeAmount(originalKey);


        // --------------------------------------------------------
        // TRANSPOSE CHORDS
        // --------------------------------------------------------

        const transposedChords = song.chords.map(
            chord => transposeChord(
                chord,
                transposeAmount
            )
        );


        // --------------------------------------------------------
        // TRANSPOSE KEY INFORMATION
        // --------------------------------------------------------
        //
        // Keep the timing information but change the key.
        //
        // Gb:maj
        //      ↓
        // C:maj
        //
        // A:min
        //      ↓
        // C:maj
        //
        // --------------------------------------------------------

        const transposedKeys = song.key.map(
            keySegment => {

                return {
                    startTime: keySegment.startTime,
                    endTime: keySegment.endTime,
                    key: transposeKey()
                };

            }
        );


        // --------------------------------------------------------
        // CREATE NEW SONG OBJECT
        // --------------------------------------------------------

        transformedSongs.push({

            songId: song.songId,

            key: transposedKeys,

            chords: transposedChords

        });
    }

    return transformedSongs;
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    transposeSongsToCMajor
};