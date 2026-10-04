"use strict";

/*
============================================================
HIDDEN MARKOV MODEL FOR CHORD SEQUENCES
============================================================

INPUT DATASET
-------------

The class expects the transposed dataset:

[
    {
        songId: "001",

        key: [
            {
                startTime: 0,
                endTime: 191,
                key: "C:maj"
            }
        ],

        chords: [
            "C:maj",
            "F:maj",
            "G:dom7",
            "C:maj",
            "A:min"
        ]
    },

    {
        songId: "002",

        key: [
            {
                startTime: 0,
                endTime: 200,
                key: "C:maj"
            }
        ],

        chords: [
            "C:maj",
            "A:min",
            "F:maj",
            "G:dom7"
        ]
    }
]


MODEL
-----

The HMM contains:

    pi = initial-state probability vector

    A  = state transition matrix

    B  = emission probability matrix


There are:

    N = number of hidden states
    M = number of unique chord observations


The model learns:

    P(state_1)

    P(state_t | state_(t-1))

    P(chord_t | state_t)


The hidden states are NOT directly interpreted as chords.

Instead:

    hidden state
          |
          v
    probability distribution
          |
          v
       chords


This allows the model to discover latent harmonic patterns.

============================================================
*/


class ChordHMM {

    // ========================================================
    // CONSTRUCTOR
    // ========================================================

    constructor(dataset) {

        if (!Array.isArray(dataset)) {
            throw new Error(
                "ChordHMM expects the dataset to be an array."
            );
        }

        if (dataset.length === 0) {
            throw new Error(
                "The dataset cannot be empty."
            );
        }

        this.dataset = dataset;

        // ----------------------------------------------------
        // Extract all chord sequences
        // ----------------------------------------------------

        this.sequences = dataset
            .map(song => song.chords)
            .filter(
                chords =>
                    Array.isArray(chords) &&
                    chords.length > 0
            );

        if (this.sequences.length === 0) {
            throw new Error(
                "Dataset does not contain any chord sequences."
            );
        }

        // ----------------------------------------------------
        // Build chord vocabulary
        // ----------------------------------------------------

        this.vocabulary = this.buildVocabulary();

        this.chordToIndex = new Map();

        this.vocabulary.forEach(
            (chord, index) => {
                this.chordToIndex.set(
                    chord,
                    index
                );
            }
        );

        this.indexToChord = this.vocabulary.slice();

        // ----------------------------------------------------
        // Number of observations
        // ----------------------------------------------------

        this.M = this.vocabulary.length;


        // ----------------------------------------------------
        // Number of hidden states
        // ----------------------------------------------------
        //
        // A useful starting point is to use roughly the same
        // number of hidden states as unique chord observations.
        //
        // However, the hidden states are still latent states.
        //
        // You can change this later using:
        //
        //     setNumberOfStates(number)
        //
        // before training.
        //
        // ----------------------------------------------------

        this.N = Math.max(
            1,
            Math.min(
                this.M,
                Math.ceil(Math.sqrt(this.M) * 2)
            )
        );


        // ----------------------------------------------------
        // HMM parameters
        // ----------------------------------------------------

        this.pi = null;
        this.A = null;
        this.B = null;


        // ----------------------------------------------------
        // Numerical stability
        // ----------------------------------------------------

        this.EPSILON = 1e-12;


        // ----------------------------------------------------
        // Training status
        // ----------------------------------------------------

        this.isInitialized = false;
        this.isTrained = false;
    }


    // ========================================================
    // SET NUMBER OF HIDDEN STATES
    // ========================================================

    setNumberOfStates(numberOfStates) {

        if (
            !Number.isInteger(numberOfStates) ||
            numberOfStates < 1
        ) {
            throw new Error(
                "Number of states must be a positive integer."
            );
        }

        this.N = numberOfStates;

        this.isInitialized = false;
        this.isTrained = false;

        return this;
    }


    // ========================================================
    // BUILD VOCABULARY
    // ========================================================

    buildVocabulary() {

        const vocabularySet = new Set();

        for (const sequence of this.sequences) {

            for (const chord of sequence) {

                vocabularySet.add(chord);
            }
        }

        return Array.from(
            vocabularySet
        ).sort();
    }


    // ========================================================
    // RANDOM NUMBER
    // ========================================================

    random() {

        return Math.random();
    }


    // ========================================================
    // CREATE RANDOM VECTOR
    // ========================================================

    randomVector(length) {

        const vector = [];

        let total = 0;

        for (let i = 0; i < length; i++) {

            const value =
                this.random() + 0.1;

            vector.push(value);

            total += value;
        }

        return vector.map(
            value => value / total
        );
    }


    // ========================================================
    // CREATE RANDOM MATRIX
    // ========================================================

    randomMatrix(rows, columns) {

        const matrix = [];

        for (let i = 0; i < rows; i++) {

            matrix.push(
                this.randomVector(columns)
            );
        }

        return matrix;
    }


    // ========================================================
    // INITIALIZE HMM
    // ========================================================
    //
    // Creates:
    //
    // pi
    // A
    // B
    //
    // --------------------------------------------------------

    initialize() {

        // ----------------------------------------------------
        // Initial state probabilities
        // ----------------------------------------------------

        this.pi = this.randomVector(
            this.N
        );


        // ----------------------------------------------------
        // Transition probabilities
        // ----------------------------------------------------

        this.A = this.randomMatrix(
            this.N,
            this.N
        );


        // ----------------------------------------------------
        // Emission probabilities
        // ----------------------------------------------------

        this.B = this.randomMatrix(
            this.N,
            this.M
        );


        this.isInitialized = true;
        this.isTrained = false;

        return this;
    }


    // ========================================================
    // NORMALIZE VECTOR
    // ========================================================

    normalizeVector(vector) {

        let sum = 0;

        for (const value of vector) {
            sum += value;
        }

        if (
            !Number.isFinite(sum) ||
            sum <= this.EPSILON
        ) {
            const uniform =
                1 / vector.length;

            return vector.map(
                () => uniform
            );
        }

        return vector.map(
            value =>
                Math.max(
                    value / sum,
                    this.EPSILON
                )
        );
    }


    // ========================================================
    // NORMALIZE MATRIX ROWS
    // ========================================================

    normalizeMatrix(matrix) {

        return matrix.map(
            row => this.normalizeVector(row)
        );
    }


    // ========================================================
    // CONVERT CHORD SEQUENCE TO INTEGER OBSERVATIONS
    // ========================================================

    encodeSequence(chords) {

        if (!Array.isArray(chords)) {
            throw new Error(
                "Chord sequence must be an array."
            );
        }

        return chords.map(chord => {

            const index =
                this.chordToIndex.get(chord);

            if (index === undefined) {

                throw new Error(
                    `Unknown chord "${chord}".`
                );
            }

            return index;
        });
    }


    // ========================================================
    // ENCODE SEQUENCE SAFELY
    // ========================================================
    //
    // Useful for anomaly detection.
    //
    // Unknown chords are returned as -1.
    //
    // ========================================================

    encodeSequenceAllowUnknown(chords) {

        return chords.map(chord => {

            const index =
                this.chordToIndex.get(chord);

            if (index === undefined) {
                return -1;
            }

            return index;
        });
    }


    // ========================================================
    // FORWARD ALGORITHM
    // ========================================================
    //
    // Calculates:
    //
    // alpha[t][i]
    //
    // = probability of observing:
    //
    // o1, o2, ..., ot
    //
    // and being in hidden state i at time t.
    //
    // --------------------------------------------------------
    //
    // Scaling is used to prevent numerical underflow.
    //
    // --------------------------------------------------------
    //
    // Returns:
    //
    // {
    //     alpha,
    //     scales,
    //     logLikelihood,
    //     probability
    // }
    //
    // ========================================================

    forward(chords) {

        if (!this.isInitialized) {
            throw new Error(
                "HMM has not been initialized."
            );
        }

        const observations =
            this.encodeSequence(chords);

        const T = observations.length;

        if (T === 0) {
            return {
                alpha: [],
                scales: [],
                logLikelihood: 0,
                probability: 1
            };
        }


        // ----------------------------------------------------
        // alpha matrix
        // ----------------------------------------------------

        const alpha =
            Array.from(
                { length: T },
                () => Array(this.N).fill(0)
            );


        // ----------------------------------------------------
        // Scaling factors
        // ----------------------------------------------------

        const scales =
            Array(T).fill(0);


        // ====================================================
        // TIME = 0
        // ====================================================

        let scale = 0;

        for (let i = 0; i < this.N; i++) {

            alpha[0][i] =
                this.pi[i] *
                this.B[i][observations[0]];

            scale += alpha[0][i];
        }


        scale = Math.max(
            scale,
            this.EPSILON
        );

        scales[0] = scale;


        for (let i = 0; i < this.N; i++) {

            alpha[0][i] /= scale;
        }


        // ====================================================
        // REMAINING TIME STEPS
        // ====================================================

        for (let t = 1; t < T; t++) {

            scale = 0;

            for (let j = 0; j < this.N; j++) {

                let probability = 0;

                for (let i = 0; i < this.N; i++) {

                    probability +=
                        alpha[t - 1][i] *
                        this.A[i][j];
                }

                alpha[t][j] =
                    probability *
                    this.B[j][observations[t]];

                scale += alpha[t][j];
            }


            scale = Math.max(
                scale,
                this.EPSILON
            );

            scales[t] = scale;


            for (let j = 0; j < this.N; j++) {

                alpha[t][j] /= scale;
            }
        }


        // ====================================================
        // LOG LIKELIHOOD
        // ====================================================
        //
        // Because:
        //
        // P(O) = product(scales)
        //
        // log P(O) = sum(log(scales))
        //
        // ====================================================

        let logLikelihood = 0;

        for (const scaleValue of scales) {

            logLikelihood +=
                Math.log(
                    Math.max(
                        scaleValue,
                        this.EPSILON
                    )
                );
        }


        // Since scaling factors are normally <= 1,
        // log likelihood is negative.
        //
        // Example:
        //
        // log P(O) = -25.4
        //

        const probability =
            Math.exp(logLikelihood);


        return {
            alpha,
            scales,
            logLikelihood,
            probability
        };
    }


    // ========================================================
    // BACKWARD ALGORITHM
    // ========================================================
    //
    // Used internally by Baum-Welch.
    //
    // beta[t][i] =
    //
    // probability of observing future observations
    // given hidden state i at time t.
    //
    // ========================================================

    backward(chords, scales = null) {

        if (!this.isInitialized) {
            throw new Error(
                "HMM has not been initialized."
            );
        }

        const observations =
            this.encodeSequence(chords);

        const T = observations.length;

        if (T === 0) {
            return [];
        }


        // ----------------------------------------------------
        // If scales were not supplied, run forward first.
        // ----------------------------------------------------

        if (scales === null) {

            const result =
                this.forward(chords);

            scales =
                result.scales;
        }


        const beta =
            Array.from(
                { length: T },
                () => Array(this.N).fill(0)
            );


        // ====================================================
        // FINAL TIME STEP
        // ====================================================

        for (let i = 0; i < this.N; i++) {

            beta[T - 1][i] = 1;
        }


        // ====================================================
        // MOVE BACKWARDS
        // ====================================================

        for (let t = T - 2; t >= 0; t--) {

            for (let i = 0; i < this.N; i++) {

                let probability = 0;

                for (let j = 0; j < this.N; j++) {

                    probability +=
                        this.A[i][j] *
                        this.B[j][observations[t + 1]] *
                        beta[t + 1][j];
                }


                beta[t][i] =
                    probability /
                    Math.max(
                        scales[t + 1],
                        this.EPSILON
                    );
            }
        }


        return beta;
    }


    // ========================================================
    // FORWARD-BACKWARD
    // ========================================================
    //
    // Calculates gamma:
    //
    // gamma[t][i]
    //
    // = probability that state i was active at time t
    //
    // given the observed sequence.
    //
    // ========================================================

    forwardBackward(chords) {

        const forwardResult =
            this.forward(chords);

        const beta =
            this.backward(
                chords,
                forwardResult.scales
            );

        const alpha =
            forwardResult.alpha;

        const T =
            alpha.length;


        const gamma =
            Array.from(
                { length: T },
                () => Array(this.N).fill(0)
            );


        for (let t = 0; t < T; t++) {

            let total = 0;

            for (let i = 0; i < this.N; i++) {

                gamma[t][i] =
                    alpha[t][i] *
                    beta[t][i];

                total += gamma[t][i];
            }


            total =
                Math.max(
                    total,
                    this.EPSILON
                );


            for (let i = 0; i < this.N; i++) {

                gamma[t][i] /= total;
            }
        }


        return {
            alpha,
            beta,
            gamma,
            scales: forwardResult.scales,
            logLikelihood:
                forwardResult.logLikelihood
        };
    }


    // ========================================================
    // BAUM-WELCH TRAINING
    // ========================================================
    //
    // Baum-Welch is the EM algorithm for HMMs.
    //
    // It repeatedly performs:
    //
    // 1. E-step
    //    Estimate hidden-state probabilities.
    //
    // 2. M-step
    //    Update pi, A and B.
    //
    // The process continues until the likelihood stops
    // improving significantly.
    //
    // ========================================================

    baumWelch(
        options = {}
    ) {

        if (!this.isInitialized) {
            this.initialize();
        }


        const maxIterations =
            options.maxIterations ?? 100;

        const tolerance =
            options.tolerance ?? 1e-4;

        const verbose =
            options.verbose ?? true;


        let previousLogLikelihood =
            -Infinity;


        const history = [];


        // ====================================================
        // ITERATIONS
        // ====================================================
        console.log("Max iterations",  maxIterations)

        for (
            let iteration = 0;
            iteration < maxIterations;
            iteration++
        ) {

            // ------------------------------------------------
            // EXPECTATION COUNTS
            // ------------------------------------------------

            const newPi =
                Array(this.N).fill(0);

            const newA =
                Array.from(
                    { length: this.N },
                    () => Array(this.N).fill(0)
                );

            const newB =
                Array.from(
                    { length: this.N },
                    () => Array(this.M).fill(0)
                );


            let totalLogLikelihood = 0;


            // =================================================
            // PROCESS EVERY SONG
            // =================================================

            for (const sequence of this.sequences) {

                if (sequence.length === 0) {
                    continue;
                }


                const result =
                    this.forwardBackward(
                        sequence
                    );


                const alpha =
                    result.alpha;

                const beta =
                    result.beta;

                const gamma =
                    result.gamma;

                const observations =
                    this.encodeSequence(
                        sequence
                    );


                const T =
                    observations.length;


                totalLogLikelihood +=
                    result.logLikelihood;


                // =============================================
                // PI
                // =============================================

                for (let i = 0; i < this.N; i++) {

                    newPi[i] +=
                        gamma[0][i];
                }


                // =============================================
                // B
                // =============================================

                for (let t = 0; t < T; t++) {

                    const observation =
                        observations[t];

                    for (let i = 0; i < this.N; i++) {

                        newB[i][observation] +=
                            gamma[t][i];
                    }
                }


                // =============================================
                // A
                // =============================================
                //
                // xi[t][i][j]
                //
                // probability of:
                //
                // state i at t
                // state j at t+1
                //
                // =============================================

                for (let t = 0; t < T - 1; t++) {

                    let xiTotal = 0;


                    // -----------------------------------------
                    // First calculate unnormalized xi
                    // -----------------------------------------

                    const xi =
                        Array.from(
                            { length: this.N },
                            () => Array(this.N).fill(0)
                        );


                    for (let i = 0; i < this.N; i++) {

                        for (let j = 0; j < this.N; j++) {

                            xi[i][j] =

                                alpha[t][i] *

                                this.A[i][j] *

                                this.B[j][
                                    observations[t + 1]
                                ] *

                                beta[t + 1][j];


                            xiTotal +=
                                xi[i][j];
                        }
                    }


                    xiTotal =
                        Math.max(
                            xiTotal,
                            this.EPSILON
                        );


                    // -----------------------------------------
                    // Normalize xi
                    // -----------------------------------------

                    for (let i = 0; i < this.N; i++) {

                        for (let j = 0; j < this.N; j++) {

                            xi[i][j] /=
                                xiTotal;

                            newA[i][j] +=
                                xi[i][j];
                        }
                    }
                }
            }


            // =================================================
            // MAXIMIZATION STEP
            // =================================================


            // -------------------------------------------------
            // Update pi
            // -------------------------------------------------

            this.pi =
                this.normalizeVector(
                    newPi
                );


            // -------------------------------------------------
            // Update A
            // -------------------------------------------------

            for (let i = 0; i < this.N; i++) {

                const rowSum =
                    newA[i].reduce(
                        (sum, value) =>
                            sum + value,
                        0
                    );


                if (
                    rowSum <= this.EPSILON
                ) {

                    this.A[i] =
                        this.randomVector(
                            this.N
                        );

                } else {

                    for (let j = 0; j < this.N; j++) {

                        this.A[i][j] =
                            Math.max(
                                newA[i][j] /
                                    rowSum,
                                this.EPSILON
                            );
                    }

                    this.A[i] =
                        this.normalizeVector(
                            this.A[i]
                        );
                }
            }


            // -------------------------------------------------
            // Update B
            // -------------------------------------------------

            for (let i = 0; i < this.N; i++) {

                const rowSum =
                    newB[i].reduce(
                        (sum, value) =>
                            sum + value,
                        0
                    );


                if (
                    rowSum <= this.EPSILON
                ) {

                    this.B[i] =
                        this.randomVector(
                            this.M
                        );

                } else {

                    for (let k = 0; k < this.M; k++) {

                        this.B[i][k] =
                            Math.max(
                                newB[i][k] /
                                    rowSum,
                                this.EPSILON
                            );
                    }

                    this.B[i] =
                        this.normalizeVector(
                            this.B[i]
                        );
                }
            }


            // =================================================
            // CHECK CONVERGENCE
            // =================================================

            history.push(
                totalLogLikelihood
            );


            if (verbose) {

                console.log(
                    `Iteration ${iteration + 1}` +
                    ` | Log Likelihood: ` +
                    `${totalLogLikelihood.toFixed(6)}`
                );
            }


            const improvement =
                Math.abs(
                    totalLogLikelihood -
                    previousLogLikelihood
                );


            if (
                iteration > 0 &&
                improvement < tolerance
            ) {

                if (verbose) {

                    console.log(
                        "Baum-Welch converged."
                    );
                }

                break;
            }


            previousLogLikelihood =
                totalLogLikelihood;
        }


        this.isTrained = true;


        return {
            pi: this.pi,
            A: this.A,
            B: this.B,
            history
        };
    }


    // ========================================================
    // LOG LIKELIHOOD
    // ========================================================
    //
    // Measures how likely a chord sequence is under the
    // current HMM.
    //
    // Example:
    //
    // ["C:maj", "F:maj", "G:dom7"]
    //
    // Returns:
    //
    // {
    //     logLikelihood: -5.32,
    //     probability: 0.00487
    // }
    //
    // ========================================================

    sequenceLikelihood(chords) {

        const result =
            this.forward(chords);

        return {
            logLikelihood:
                result.logLikelihood,

            probability:
                result.probability
        };
    }


    // ========================================================
    // ANOMALY DETECTION
    // ========================================================
    //
    // Given:
    //
    // C F G
    //
    // determine how likely this sequence is under the
    // learned chord distribution.
    //
    // The most useful value is generally:
    //
    // logLikelihood
    //
    // because probability can become extremely small.
    //
    // A HIGHER log-likelihood means the sequence is more
    // consistent with the model.
    //
    // A LOWER log-likelihood means the sequence is less
    // consistent with the model.
    //
    // anomalyScore is:
    //
    //     -logLikelihood
    //
    // Therefore:
    //
    // HIGH anomalyScore
    //     =
    //     more unusual sequence
    //
    // ========================================================

    anomalyDetection(chords) {

        if (!this.isInitialized) {
            throw new Error(
                "HMM has not been initialized."
            );
        }


        // ----------------------------------------------------
        // Check for unknown chords
        // ----------------------------------------------------

        const unknownChords =
            chords.filter(
                chord =>
                    !this.chordToIndex.has(chord)
            );


        if (unknownChords.length > 0) {

            return {
                sequence: chords,

                probability: 0,

                logLikelihood:
                    -Infinity,

                anomalyScore:
                    Infinity,

                isAnomaly: true,

                unknownChords
            };
        }


        const result =
            this.sequenceLikelihood(
                chords
            );


        return {

            sequence: chords,

            probability:
                result.probability,

            logLikelihood:
                result.logLikelihood,

            anomalyScore:
                -result.logLikelihood,

            isAnomaly: false,

            unknownChords: []
        };
    }


    // ========================================================
    // NEXT CHORD PREDICTION
    // ========================================================
    //
    // Given:
    //
    // C:maj
    // F:maj
    // G:dom7
    //
    // calculate:
    //
    // P(next chord | observed sequence)
    //
    // Formula:
    //
    // P(O_(t+1) = k | O_1:t)
    //
    // =
    //
    // sum_i
    //
    //     P(state_t = i | O_1:t)
    //
    //     *
    //
    //     sum_j
    //
    //         A[i][j] * B[j][k]
    //
    // ========================================================

    predictNextChord(chords, topK = 5) {

        if (!this.isInitialized) {
            throw new Error(
                "HMM has not been initialized."
            );
        }


        if (
            !Array.isArray(chords) ||
            chords.length === 0
        ) {
            throw new Error(
                "A non-empty chord sequence is required."
            );
        }


        // ----------------------------------------------------
        // Run forward algorithm
        // ----------------------------------------------------

        const result =
            this.forward(chords);


        const alpha =
            result.alpha;


        const lastAlpha =
            alpha[alpha.length - 1];


        // ----------------------------------------------------
        // alpha's final row is scaled.
        //
        // Normalize it to obtain:
        //
        // P(state_t | observations)
        //
        // ----------------------------------------------------

        const statePosterior =
            this.normalizeVector(
                lastAlpha
            );


        // ----------------------------------------------------
        // Calculate next chord probabilities
        // ----------------------------------------------------

        const chordProbabilities =
            Array(this.M).fill(0);


        for (let i = 0; i < this.N; i++) {

            for (let j = 0; j < this.N; j++) {

                const transitionProbability =
                    this.A[i][j];


                for (let k = 0; k < this.M; k++) {

                    chordProbabilities[k] +=

                        statePosterior[i] *

                        transitionProbability *

                        this.B[j][k];
                }
            }
        }


        // ----------------------------------------------------
        // Normalize
        // ----------------------------------------------------

        const normalized =
            this.normalizeVector(
                chordProbabilities
            );


        // ----------------------------------------------------
        // Convert to chord names
        // ----------------------------------------------------

        const predictions =
            normalized
                .map(
                    (probability, index) => ({
                        chord:
                            this.indexToChord[index],

                        probability
                    })
                )
                .sort(
                    (a, b) =>
                        b.probability -
                        a.probability
                )
                .slice(
                    0,
                    topK
                );


        return predictions;
    }


    // ========================================================
    // GENERATE NEXT CHORD
    // ========================================================
    //
    // Uses the probability distribution to sample one chord.
    //
    // This is different from predictNextChord().
    //
    // predictNextChord():
    //     gives ranked probabilities.
    //
    // generateNextChord():
    //     randomly samples one chord from that distribution.
    //
    // ========================================================

    generateNextChord(chords) {

        const predictions =
            this.predictNextChord(
                chords,
                this.M
            );


        const randomValue =
            Math.random();


        let cumulative = 0;


        for (const prediction of predictions) {

            cumulative +=
                prediction.probability;

            if (
                randomValue <= cumulative
            ) {

                return prediction.chord;
            }
        }


        return predictions[
            predictions.length - 1
        ].chord;
    }


    // ========================================================
    // GENERATE CHORD SEQUENCE
    // ========================================================
    //
    // Example:
    //
    // generateSequence(
    //     ["C:maj"],
    //     10
    // )
    //
    // ========================================================

    generateSequence(
        startingChords,
        length
    ) {

        if (
            !Number.isInteger(length) ||
            length < 1
        ) {
            throw new Error(
                "Length must be a positive integer."
            );
        }


        const sequence =
            startingChords.slice();


        while (
            sequence.length < length
        ) {

            const nextChord =
                this.generateNextChord(
                    sequence
                );


            sequence.push(
                nextChord
            );
        }


        return sequence;
    }


    // ========================================================
    // MOST LIKELY NEXT CHORD
    // ========================================================
    //
    // Deterministic version of next-chord generation.
    //
    // ========================================================

    mostLikelyNextChord(chords) {

        const predictions =
            this.predictNextChord(
                chords,
                1
            );


        return predictions[0];
    }


    // ========================================================
    // GET STATE POSTERIOR
    // ========================================================
    //
    // Useful for understanding which hidden states the model
    // believes are active after observing a chord sequence.
    //
    // ========================================================

    getStatePosterior(chords) {

        const result =
            this.forward(chords);


        return this.normalizeVector(
            result.alpha[
                result.alpha.length - 1
            ]
        );
    }


    // ========================================================
    // GET MODEL
    // ========================================================
    //
    // Returns the actual HMM parameters.
    //
    // ========================================================

    getModel() {

        return {

            pi: this.pi,

            A: this.A,

            B: this.B,

            states: this.N,

            observations: this.M,

            vocabulary:
                this.vocabulary
        };
    }


//print Model
printModel(){}

getNextChordProbability(
    chords,
    targetChord
) {

    if (
        !this.chordToIndex.has(
            targetChord
        )
    ) {

        return 0;
    }


    const result =
        this.forward(
            chords
        );


    const alpha =
        result.alpha[
            result.alpha.length - 1
        ];


    // --------------------------------------------------------
    // Normalize final alpha.
    // --------------------------------------------------------

    const statePosterior =
        this.normalizeVector(
            alpha
        );


    let probability = 0;


    // ========================================================
    // SUM OVER ALL CURRENT STATES AND NEXT STATES
    // ========================================================

    const targetIndex =
        this.chordToIndex.get(
            targetChord
        );


    for (
        let i = 0;
        i < this.N;
        i++
    ) {

        for (
            let j = 0;
            j < this.N;
            j++
        ) {

            probability +=

                statePosterior[i] *

                this.A[i][j] *

                this.B[j][targetIndex];
        }
    }


    return probability;
}


//Evaluate Model performance
evaluate(testDataset, options = {}) {

    if (!Array.isArray(testDataset)) {

        throw new Error(
            "Testing dataset must be an array of songs."
        );
    }


    if (!this.isInitialized) {

        throw new Error(
            "The HMM must be initialized/trained before evaluation."
        );
    }


    const topK =
        options.topK ?? 5;


    // --------------------------------------------------------
    // Overall counters
    // --------------------------------------------------------

    let totalPredictions = 0;

    let correctPredictions = 0;

    let topKCorrectPredictions = 0;


    // --------------------------------------------------------
    // Cross entropy
    // --------------------------------------------------------

    let totalNegativeLogLikelihood = 0;


    // --------------------------------------------------------
    // Sequence likelihood
    // --------------------------------------------------------

    let totalSequenceLogLikelihood = 0;

    let totalChords = 0;


    // --------------------------------------------------------
    // Song-level results
    // --------------------------------------------------------

    const songResults = [];


    // ========================================================
    // PROCESS EACH SONG
    // ========================================================

    for (const song of testDataset) {

        if (
            !song ||
            !Array.isArray(song.chords)
        ) {
            continue;
        }


        const chords =
            song.chords;


        if (chords.length < 2) {
            continue;
        }


        // ----------------------------------------------------
        // SONG COUNTERS
        // ----------------------------------------------------

        let songCorrect = 0;

        let songPredictions = 0;

        let songLoss = 0;


        // ====================================================
        // NEXT-CHORD PREDICTION
        // ====================================================
        //
        // Example:
        //
        // [C, F, G, C]
        //
        // We evaluate:
        //
        // C       -> F
        // C,F     -> G
        // C,F,G   -> C
        //
        // ====================================================

        for (
            let t = 1;
            t < chords.length;
            t++
        ) {

            const history =
                chords.slice(0, t);


            const actualChord =
                chords[t];


            // ------------------------------------------------
            // Skip unknown chords
            // ------------------------------------------------

            if (
                !this.chordToIndex.has(
                    actualChord
                )
            ) {
                continue;
            }


            // ------------------------------------------------
            // Predict next chord
            // ------------------------------------------------

            const predictions =
                this.predictNextChord(
                    history,
                    topK
                );


            totalPredictions++;

            songPredictions++;


            // ------------------------------------------------
            // Top-1 Accuracy
            // ------------------------------------------------

            if (
                predictions.length > 0 &&
                predictions[0].chord ===
                    actualChord
            ) {

                correctPredictions++;

                songCorrect++;
            }


            // ------------------------------------------------
            // Top-K Accuracy
            // ------------------------------------------------

            const topKContainsActual =
                predictions.some(
                    prediction =>
                        prediction.chord ===
                        actualChord
                );


            if (topKContainsActual) {

                topKCorrectPredictions++;
            }


            // ------------------------------------------------
            // Cross Entropy Loss
            // ------------------------------------------------
            //
            // Loss =
            //
            // -log(P(actual chord))
            //
            // If the model gives:
            //
            // P(actual) = 0.8
            //
            // loss = -log(0.8)
            //
            //            = 0.223
            //
            //
            // If:
            //
            // P(actual) = 0.01
            //
            // loss = -log(0.01)
            //
            //            = 4.605
            //
            // Therefore lower is better.
            //
            // ------------------------------------------------

            const actualPrediction =
                predictions.find(
                    prediction =>
                        prediction.chord ===
                        actualChord
                );


            let probability;


            if (actualPrediction) {

                probability =
                    actualPrediction.probability;

            } else {

                // ------------------------------------------------
                // predictNextChord() may only return topK.
                // Therefore, if actual chord is not in topK,
                // calculate its complete probability.
                // ------------------------------------------------

                probability =
                    this.getNextChordProbability(
                        history,
                        actualChord
                    );
            }


            probability =
                Math.max(
                    probability,
                    this.EPSILON
                );


            const loss =
                -Math.log(
                    probability
                );


            totalNegativeLogLikelihood +=
                loss;


            songLoss += loss;
        }


        // ====================================================
        // SEQUENCE LOG LIKELIHOOD
        // ====================================================

        const knownChords =
            chords.filter(
                chord =>
                    this.chordToIndex.has(
                        chord
                    )
            );


        if (knownChords.length > 0) {

            const sequenceResult =
                this.sequenceLikelihood(
                    knownChords
                );


            totalSequenceLogLikelihood +=
                sequenceResult.logLikelihood;


            totalChords +=
                knownChords.length;
        }


        // ====================================================
        // SONG RESULT
        // ====================================================

        if (songPredictions > 0) {

            songResults.push({

                songId:
                    song.songId,

                accuracy:
                    songCorrect /
                    songPredictions,

                predictions:
                    songPredictions,

                correct:
                    songCorrect,

                crossEntropy:
                    songLoss /
                    songPredictions
            });
        }
    }


    // ========================================================
    // FINAL METRICS
    // ========================================================

    if (totalPredictions === 0) {

        throw new Error(
            "No valid predictions could be made on the testing dataset."
        );
    }


    const accuracy =
        correctPredictions /
        totalPredictions;


    const topKAccuracy =
        topKCorrectPredictions /
        totalPredictions;


    const crossEntropy =
        totalNegativeLogLikelihood /
        totalPredictions;


    // --------------------------------------------------------
    // Perplexity
    // --------------------------------------------------------
    //
    // Perplexity =
    //
    // exp(Cross Entropy)
    //
    // Lower is better.
    //
    // --------------------------------------------------------

    const perplexity =
        Math.exp(
            crossEntropy
        );


    // --------------------------------------------------------
    // Average sequence log likelihood
    // --------------------------------------------------------

    const averageLogLikelihood =
        totalChords > 0
            ? totalSequenceLogLikelihood /
              totalChords
            : null;


    // --------------------------------------------------------
    // Return everything
    // --------------------------------------------------------

    return {

        // Number of next-chord predictions
        totalPredictions,

        // Exact next-chord accuracy
        accuracy,

        // Percentage form
        accuracyPercent:
            accuracy * 100,


        // Top-K accuracy
        topK,

        topKAccuracy,

        topKAccuracyPercent:
            topKAccuracy * 100,


        // Cross entropy
        crossEntropy,


        // Perplexity
        perplexity,


        // Sequence likelihood
        totalSequenceLogLikelihood,

        averageLogLikelihood,


        // Individual song metrics
        songResults
    };
}


}


// ============================================================
// EXPORT
// ============================================================

module.exports = ChordHMM;