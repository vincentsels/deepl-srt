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

const allEntriesAsText = allInputAsText.split('\n\n').filter(x => x);

const allEntries = allEntriesAsText.map(e => new Entry(e));

console.log(allEntries);

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