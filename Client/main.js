const chordsInput = document.getElementById("chords");

const amountInput = document.getElementById("amount");

const generateButton = document.getElementById("generateButton");

const results = document.getElementById("results");

const sequenceContainer = document.getElementById("sequence");

const count = document.getElementById("count");

const error = document.getElementById("error");

/*
 * ----------------------------------------------------
 * CHORD PARSER
 * ----------------------------------------------------
 */

function parseChords(input) {
  return input
    .split(/[,\s]+/)
    .map((chord) => chord.trim())
    .filter((chord) => chord.length > 0);
}

/*
 * ----------------------------------------------------
 * SIMPLE CHORD GENERATION
 *
 * This is the UI/demo generation logic.
 *
 * Replace generateChord() with your HMM prediction
 * function later.
 * ----------------------------------------------------
 */

function generateChord(history) {
  const lastChord = history[history.length - 1];

  /*
   * Extract the root when the chord has
   * the format:
   *
   * C:maj
   * F:min
   * G:dom7
   */

  let root = lastChord;

  if (lastChord.includes(":")) {
    root = lastChord.split(":")[0];
  }

  /*
   * Common chord movement patterns.
   *
   * This is only a demonstration.
   * Your trained HMM can replace this section.
   */

  const progressions = {
    C: ["F:maj", "G:dom7", "Am:min", "C:maj"],

    D: ["G:maj", "A:dom7", "Bm:min", "D:maj"],

    E: ["A:maj", "B:dom7", "C#m:min", "E:maj"],

    F: ["Bb:maj", "C:dom7", "Dm:min", "F:maj"],

    G: ["C:maj", "D:dom7", "Em:min", "G:maj"],

    A: ["D:maj", "E:dom7", "F#m:min", "A:maj"],

    B: ["E:maj", "F#:dom7", "G#m:min", "B:maj"],

    Am: ["F:maj", "C:maj", "G:dom7", "Am:min"],
  };

  const options = progressions[root] || ["C:maj", "F:maj", "G:dom7", "Am:min"];

  return options[Math.floor(Math.random() * options.length)];
}

/*
 * ----------------------------------------------------
 * GENERATE SEQUENCE
 * ----------------------------------------------------
 */

async function  generateSequence(chords, amount) {
     
  
     let res = await fetch('http://localhost:5000/', {
      headers: {
          "Content-Type": "application/json"
      },
      method: 'POST', 
      body: JSON.stringify({ chords, topK: amount })
     })

     return await res.json()


} 

/*
 * ----------------------------------------------------
 * DISPLAY SEQUENCE
 * ----------------------------------------------------
 */

function displaySequence(sequence) {
  sequenceContainer.innerHTML = "";

  sequence.forEach((chord, index) => {
    const chordElement = document.createElement("div");

    chordElement.className = "chord";

    const number = document.createElement("span");

    number.className = "chord-number";

    number.textContent = `CHORD ${index + 1}`;

    const value = document.createElement("span");

    value.textContent = chord;

    chordElement.appendChild(number);
    chordElement.appendChild(value);

    /*
     * Slight delay creates a nice
     * sequence animation.
     */

    chordElement.style.animationDelay = `${index * 45}ms`;

    sequenceContainer.appendChild(chordElement);
  });

  count.textContent = `${sequence.length} chords`;

  results.classList.add("visible");
}

/*
 * ----------------------------------------------------
 * ERROR HANDLING
 * ----------------------------------------------------
 */

function showError(message) {
  error.textContent = message;

  error.classList.add("visible");
}

function hideError() {
  error.classList.remove("visible");
}

/*
 * ----------------------------------------------------
 * MAIN GENERATION EVENT
 * ----------------------------------------------------
 */

generateButton.addEventListener("click", () => {
  hideError();

  const input = chordsInput.value.trim();

  if (!input) {
    showError("Please enter at least one chord.");

    return;
  }

  const chords = parseChords(input);

  if (chords.length === 0) {
    showError("No valid chords were found.");

    return;
  }

  const amount = Number(amountInput.value);

  generateButton.textContent = "Generating...";

  generateButton.disabled = true;

  /*
   * Small delay makes the generation
   * feel more natural.
   */

  setTimeout(async() => {
    const generated = await generateSequence(chords, amount);
    console.log("generated sequence", generated)

    displaySequence(generated);

    generateButton.textContent = "Generate Chord Sequence";

    generateButton.disabled = false;
  }, 350);
});

/*
 * ----------------------------------------------------
 * EXAMPLE BUTTONS
 * ----------------------------------------------------
 */

document.querySelectorAll(".example").forEach((button) => {
  button.addEventListener("click", () => {
    chordsInput.value = button.dataset.sequence;

    chordsInput.focus();
  });
});

/*
 * ----------------------------------------------------
 * ENTER KEY SUPPORT
 * ----------------------------------------------------
 */

chordsInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    generateButton.click();
  }
});
