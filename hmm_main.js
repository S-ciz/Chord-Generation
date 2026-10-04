
const express = require("express")
const {saveJSON} = require('./utils')
const POP909 = require('./pop909_chord_sequences');
const {transposeSongsToCMajor} = require("./TransposeKey")
const ChordHMM = require('./hmm');




let Transposed_dataset = transposeSongsToCMajor(POP909)

saveJSON("Transposed.json", Transposed_dataset)
console.log("successfully saved transposed dataset")

//split - train/test
let n = Transposed_dataset.length
let train_size = Math.floor(n* 0.8)
let Train_Set = Transposed_dataset.slice(0, train_size);
let Test_Set = Transposed_dataset.slice(train_size, n)

console.log({n, train: Train_Set.length, test: Test_Set.length})



const model = new ChordHMM(Transposed_dataset);

// ------------------------------------------------------------
// OPTIONAL: choose number of hidden states
// ------------------------------------------------------------

model.setNumberOfStates(8);

// ------------------------------------------------------------
// INITIALIZE
// ------------------------------------------------------------

model.initialize();

// ------------------------------------------------------------
// TRAIN USING BAUM-WELCH
// ------------------------------------------------------------


model.baumWelch({
    maxIterations: 200,
    tolerance: 0.0001,
    verbose: true
});

// ------------------------------------------------------------
// Save model
// ------------------------------------------------------------


// saveJSON("./Model/hmm.json", model.getModel())



// // Evaluate

// let metrics = model.evaluate(Test_Set)

// //save metrics

// saveJSON("./Model/hmm_metrics.json", metrics)


// ------------------------------------------------------------
// ANOMALY DETECTION
// ------------------------------------------------------------

// const result = model.anomalyDetection([
//     "C:maj",
//     "F:maj",
//     "G:dom7"
// ]);

// console.log(result);
//
// Example result:
//
// {
//     sequence: ["C:maj", "F:maj", "G:dom7"],
//     probability: 0.0012,
//     logLikelihood: -6.72,
//     anomalyScore: 6.72,
//     isAnomaly: false,
//     unknownChords: []
// }
//
// ------------------------------------------------------------
// NEXT CHORD PREDICTION
// ------------------------------------------------------------
//
// const predictions = model.predictNextChord([
//     "C:maj",
//     "F:maj",
//     "G:min"
// ], 5);

// console.log(predictions);

// Possible result:
//
// [
//     { chord: "C:maj", probability: 0.61 },
//     { chord: "A:min", probability: 0.14 },
//     { chord: "F:maj", probability: 0.10 },
//     { chord: "D:min", probability: 0.08 },
//     { chord: "G:dom7", probability: 0.04 }
// ]
//
// ------------------------------------------------------------
// GENERATE A CHORD
// ------------------------------------------------------------
//
// const next = model.generateNextChord([
//     "C:maj",
//     "F:maj",
//     "G:dom7"
// ]);
//
// console.log(next);
//
// ------------------------------------------------------------
// GENERATE A WHOLE SEQUENCE
// ------------------------------------------------------------
//
// const generated = model.generateSequence(
//     ["C:maj"],
//     20
// );
//
// console.log(generated);
//
// ============================================================


const app = express();
const PORT = 5000;


app.use(express.static('./Client'))

app.use(express.json()) //body parser


app.post("/", (req, res)=>{


    console.log(req.body)
    const {chords, topK} = req.body;

    const results = model.generateSequence(  chords,  topK)

    res.status(200).json( results)

})


app.listen(PORT, ()=>{

    console.log(`Server running on port ${PORT}`)
})



