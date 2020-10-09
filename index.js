require('./flatmap');
const commandLineArgs = require('command-line-args');
const path = require('path')
const fs = require('fs');
const Entry = require('./entry');

const optionDefinitions = [
    { name: 'input', alias: 'i', type: String },
    { name: 'output', alias: 'o', type: String },
    { name: 'from', alias: 'f', type: String },
    { name: 'to', alias: 't', type: String },
  ]

const options = commandLineArgs(optionDefinitions);

const input = options.input || getSrtFileInFolder();
let output = options.output;
const from = options.from || 'NL';
const to = options.to || 'FR';

if (!input) throw new Error('At least specify input file with --input or -i');

if (!output) output = input.split('.').slice(0, -1).join('.') + '.' + to.toLowerCase() + '.srt';

console.log('Input file:', input);
console.log('Output file:', output);
console.log('From language:', from);
console.log('To language:', to);

const allInputAsText = fs.readFileSync(input).toString();
const allEntriesAsText = allInputAsText.split(/\r?\n\r?\n/).filter(x => x);
const allEntries = allEntriesAsText.map(e => new Entry(e));

const amtOfLines = Math.max(...allEntries.map(e => e.lines.length));
const maxLineLength = Math.max(...allEntries.flatMap(e => e.lines.map(l => l.length)));

console.log('Entries: ', allEntries.length);
console.log('Lines per entry: ', amtOfLines);
console.log('Max length of line: ', maxLineLength);

let currentSentence = '';
let currentTimestamps = [];

const results = [];

for (let currentEntry of allEntries) {
  const newSentences = currentEntry.total.match(/[^\.!\?]+[\.!\?]+/g);
  let rest = '';

  if (newSentences) {
    // We got one or more new sentences here
    const sentences = [...newSentences];

    // Append any leftovers from previous ones
    if (currentSentence) {
      sentences[0] = currentSentence += (' ' + sentences[0]);
      currentSentence = '';
    }
    
    for (let sentence of sentences) {
      results.push({ sentence, ts: [...currentTimestamps, currentEntry.ts] });
      currentTimestamps = [];
    }

    rest = currentEntry.total.replace(newSentences.join(''), '');
  } else {
    // No finished sentences here
    currentTimestamps.push(currentEntry.ts)
    rest = currentEntry.total;
  }

  currentSentence = currentSentence + rest;
}

// In case the thing doesn't end in a sentence, push the rest
if (currentSentence) {
  results.push({ currentSentence, ts: [...currentTimestamps] });
}

console.log(results);

function getSrtFileInFolder() {
  const files = fs.readdirSync('.');
  for(let i = 0; i < files.length; i++){
    const filename = path.join(files[i]);
    var stat = fs.lstatSync(filename);
    if (!stat.isDirectory() && filename.indexOf('.srt') >= 0) {
      return filename;
    };
  }
  return null;
}