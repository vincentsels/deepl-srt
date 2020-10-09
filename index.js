require('./flatmap');
const commandLineArgs = require('command-line-args');
const path = require('path')
const fs = require('fs');
const Entry = require('./entry');
const axios = require('axios');
const { env } = require('process');

const optionDefinitions = [
  { name: 'input', alias: 'i', type: String },
  { name: 'output', alias: 'o', type: String },
  { name: 'source', alias: 's', type: String },
  { name: 'target', alias: 't', type: String },
  { name: 'key', alias: 'k', type: String },
  { name: 'formal', alias: 'f', type: Number },
  { name: 'verbose', alias: 'v', type: Number },
];

const options = commandLineArgs(optionDefinitions);

const key = options.key || env.DEEPL_API_KEY;
const input = options.input || getSrtFileInFolder();
let output = options.output;
const source = options.from || 'NL';
const target = options.to || 'FR';
const formality = options.formal ? 'more' : 'less';
const verbose = true; // TODO

if (!key) throw new Error('Specify a DeepL API key as DEEPL_API_KEY environment variable, or using the --key or -k parameter.')
if (!input) throw new Error('At least specify input file with --input or -i.');

if (!output) output = input.split('.').slice(0, -1).join('.') + '.' + target.toLowerCase() + '.srt';

log('Input file:', input);
log('Output file:', output);
log('Source language:', source);
log('Target language:', target);
log('Formality:', formality);

const allInputAsText = fs.readFileSync(input).toString();
if (!allInputAsText || allInputAsText.length === 0 || isNaN(allInputAsText.charAt(0))) throw new Error('Does not look like an srt file');

const allEntriesAsText = allInputAsText.split(/\r?\n\r?\n/).filter(x => x);
const allEntries = allEntriesAsText.map(e => new Entry(e));

const amtOfLines = Math.max(...allEntries.map(e => e.lines.length));
const maxLineLength = Math.max(...allEntries.flatMap(e => e.lines.map(l => l.length)));

log('Entries:', allEntries.length);
log('Lines per entry:', amtOfLines);
log('Max length of line:', maxLineLength);

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
  results.push({ sentence: currentSentence, ts: [...currentTimestamps] });
}

log(results);

const params = new URLSearchParams();
params.append('auth_key', key);
params.append('target_lang', target);
params.append('source_lang', source);
params.append('split_sentences', 0);
params.append('formality', formality);
const sentencesToTranslate = results.forEach(r => {
  params.append('text', r.sentence);
});

log('Translating...');

axios.default.post('https://api.deepl.com/v2/translate', params.toString())
  .then((response) => {
    if (response.status !== 200) {
      console.error('Request to DeepL failed', response);
      throw new Error(response.data);
    } else {
      const translations = response.data.translations.map(t => t.text);
      log(translations);

      const targetEntries = allEntries.map((e) => {
        const trans = new Entry();
        trans.lineNumber = e.lineNumber;
        trans.lines = [];
        trans.ts = e.ts;
        return trans;
      });

      let overflow = false;

      translations.forEach((trans, i) => {
        const ts = results[i].ts[0];
        const words = trans.split(' ');

        let targetEntry = targetEntries.find(e => e.ts >= ts);

        for (let word of words) {
          if (targetEntry.lines.length === amtOfLines
            && targetEntry.lines[amtOfLines - 1].length + word.length + 1 > maxLineLength) {
            // Entry full, go to the next one
            log('Entry', targetEntry.lineNumber, 'full, go to next one'); // TODO remove
            targetEntry = targetEntries.find(e => e.ts > targetEntry.ts);
            if (targetEntry === undefined) {
              // We're at the last one - just keep appending to it...
              log('Entries full, appending to last one...'); // TODO remove
              overflow = true;
              targetEntry = targetEntries.find(e => e.ts >= ts);
            } else {
              log('Entry', targetEntry.lineNumber, 'selected'); // TODO remove
            }
          }

          if (targetEntry.lines.length === 0) {
            // First word in this entry
            log('Adding first word', word, 'to', targetEntry.lineNumber); // TODO remove
            targetEntry.lines.push(word);
          } else if ((overflow || targetEntry.lines.length < amtOfLines)
            && targetEntry.lines[targetEntry.lines.length - 1].length + word.length + 1 > maxLineLength) {
            // Line in entry full, but place for a new one... Add new line in this entry
            log('Adding first word', word, 'to new line of', targetEntry.lineNumber); // TODO remove
            targetEntry.lines.push(word);
          } else {
            // No problem to add this word to the last line in this entry
            log('Adding word', word, 'to', targetEntry.lineNumber); // TODO remove
            targetEntry.lines[targetEntry.lines.length - 1] += " " + word;
          }
        }
      });

      log('Done, writing file...');
      fs.writeFileSync(output, targetEntries.reduce((p, c) => p + c.toText(), ''));
      log('Finished.');
    }
  })
  .catch((err) => { 
    console.error('Translation failed', err);
    throw new Error(err);
  });

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

function log(...args) {
  if (verbose) console.log(...args);
}
