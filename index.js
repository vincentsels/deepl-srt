var commandLineArgs = require('command-line-args');
var path = require('path')

const optionDefinitions = [
    { name: 'input', alias: 'i', type: String },
    { name: 'output', alias: 'o', type: String },
    { name: 'from', alias: 'f', type: String },
    { name: 'to', alias: 't', type: String },
  ]

const options = commandLineArgs(optionDefinitions);

const input = options.input;
let output = options.output;
const from = options.from || 'NL';
const to = options.to || 'FR';

if (!input) throw new Error('At least specify input file with --input or -i');

if (!output) output = options.input.split('.').slice(0, -1).join('.') + '.' + to.toLowerCase() + path.extname('index.html');

console.log('Input file:', input);
console.log('Output file:', output);
console.log('From language:', from);
console.log('To language:', to);