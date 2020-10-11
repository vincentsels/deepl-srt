require('./flatmap');
const commandLineArgs = require('command-line-args');
const path = require('path')
const fs = require('fs');
const Entry = require('./entry');
const axios = require('axios');
var wordcount = require('wordcount');
const { env } = require('process');

const optionDefinitions = [
  { name: 'input', alias: 'i', type: String },
  { name: 'output', alias: 'o', type: String },
  { name: 'source', alias: 's', type: String },
  { name: 'target', alias: 't', type: String },
  { name: 'key', alias: 'k', type: String },
  { name: 'formal', alias: 'f', type: Boolean },
  { name: 'debug', alias: 'd', type: Boolean },
  { name: 'lines', alias: 'l', type: Number },
  { name: 'maxlength', alias: 'm', type: Number },
];

const options = commandLineArgs(optionDefinitions);

const key = options.key || env.DEEPL_API_KEY;
const input = options.input || getSrtFileInFolder();
let output = options.output;
const source = options.from || 'NL';
const target = options.to || 'FR';
const formality = options.formal ? 'more' : 'less';
const logDebug = options.debug;

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

const allEntriesAsText = allInputAsText.split(/\r?\n\r?\n/).filter(x => x.trim());
const allEntries = allEntriesAsText.map(e => new Entry(e));

const amtOfLines = options.lines || Math.max(...allEntries.map(e => e.lines.length));
const maxLineLength = options.maxlength || Math.max(...allEntries.flatMap(e => e.lines.map(l => l.length)));

const sourceWordCount = wordcount(allEntries.flatMap(e => e.lines).join(' '));

log('Entries:', allEntries.length);
log('Lines per entry:', amtOfLines);
log('Max length of line:', maxLineLength);
log('Source word count:', sourceWordCount);

let currentSentence = '';
let currentTimestamps = [];

const results = [];

for (let currentEntry of allEntries) {
  // debug('Treating entry', currentEntry);
  const newSentences = currentEntry.total.match(/[^\.!\?]+[\.!\?]+/g);
  let rest = '';

  if (newSentences) {
    // debug('New sentences', newSentences);
    // We got one or more new sentences here
    const sentences = [...newSentences];

    // Append any leftovers from previous ones
    if (currentSentence) {
      sentences[0] = currentSentence += (' ' + sentences[0]);
      currentSentence = '';
      // debug('Added leftover from previous sentence to first new sentence', sentences[0]);
    }
    
    for (let sentence of sentences) {
      results.push({ sentence, ts: [...currentTimestamps, currentEntry.ts] });
      // debug('Added sentence', sentence, 'with timestamps', [...currentTimestamps, currentEntry.ts]);
      currentTimestamps = [];
    }

    rest = currentEntry.total.replace(newSentences.join(''), '');
  } else {
    // No finished sentences here
    rest = currentEntry.total;
    // debug('No new sentences, just add rest', currentEntry.total);
  }

  currentSentence = currentSentence ? (currentSentence + ' ' + rest) : rest;
  if (rest) {
    currentTimestamps.push(currentEntry.ts);
    // debug('Set currentSentence', currentSentence, 'with ts', currentEntry.ts);
  }
}

// In case the thing doesn't end in a sentence, push the rest
if (currentSentence) {
  results.push({ sentence: currentSentence, ts: [...currentTimestamps] });
  // debug('Pushed remainder', currentSentence, 'with ts', [...currentTimestamps]);
}

debug(results);

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
      debug(translations);
      const targetWordCount = wordcount(translations.join(' '));
      const lengthFactor = targetWordCount / sourceWordCount;
      log('Target word count:', targetWordCount, 'factor:', lengthFactor);

      const targetEntries = allEntries.map((e) => {
        const trans = new Entry();
        trans.lineNumber = e.lineNumber;
        trans.lines = [];
        trans.ts = e.ts;
        trans.wordCount = Math.ceil(e.wordCount * lengthFactor);
        return trans;
      });

      let overflow = false;

      translations.forEach((trans, i) => {
        const ts = results[i].ts[0];
        const words = trans.split(' ');

        let targetEntry = targetEntries.find(e => e.ts >= ts);

        for (let word of words) {
          if (targetEntry.lines.length === amtOfLines
            && (targetEntry.lines[amtOfLines - 1].length + word.length + 1 > maxLineLength
              || wordcount(targetEntry.lines.join(' ')) >= targetEntry.wordCount)) {
            // Entry full, go to the next one
            debug('Entry', targetEntry.lineNumber, 'contains more than its', targetEntry.wordCount, 'words, go to next one');
            targetEntry = targetEntries.find(e => e.ts > targetEntry.ts);
            if (targetEntry === undefined) {
              // We're at the last one - just keep appending to it...
              debug('Entries full, appending to last one...');
              overflow = true;
              targetEntry = targetEntries.find(e => e.ts >= ts);
            } else {
              debug('Entry', targetEntry.lineNumber, 'selected');
            }
          }

          if (targetEntry.lines.length === 0) {
            // First word in this entry
            debug('Adding first word', word, 'to', targetEntry.lineNumber);
            targetEntry.lines.push(word);
          } else if ((overflow || targetEntry.lines.length < amtOfLines)
            && targetEntry.lines[targetEntry.lines.length - 1].length + word.length + 1 > maxLineLength) {
            // Line in entry full, but place for a new one... Add new line in this entry
            debug('Adding first word', word, 'to new line of', targetEntry.lineNumber);
            targetEntry.lines.push(word);
          } else {
            // No problem to add this word to the last line in this entry
            debug('Adding word', word, 'to', targetEntry.lineNumber);
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
  console.log(...args);
}

function debug(...args) {
  if (logDebug) console.log(...args);
}
