# DeepL srt translator

Node.js CLI tool to translate .srt files using the DeepL API. Requires a [DeepL API key](https://www.deepl.com/nl/docs-api/).

Translates sentence-per-sentence, and lays out the result over the source's timestamps.

## Installation

    npm install

## Usage

    node index [options]

### Options

- **--input** / **-i**: The input file. If left blank, uses the first .srt file in the directory.
- **--output** / **-o**: The output file. If left blank, appends the target language to the source's file name. E.g. source file movie.srt would become movie.fr.srt if the target language is French.
- **--source** / **-s**: The source language. One of the [DeepL language strings](https://www.deepl.com/docs-api/translating-text/request/). Default auto-detect.
- **--target** / **-t**: The target language. One of the [DeepL language strings](https://www.deepl.com/docs-api/translating-text/request/). Default FR.
- **--key** / **-k**: Your DeepL API key. Can also be set as environment variable `DEEPL_API_KEY`.
- **--formal** / **-f**: Flag. DeepL setting: prefer formal language. Default false.
- **--debug** / **-d**: Flag. Also log debug statements, word-per-word. Default false.
- **--lines** / **-l**: The maximum number of lines per entry. If unspecified, takes the maximum of the input file.
- **--maxlength** / **-m**: The maximum number of characters per line. If unspecified, takes the maximum of the input file. 
- **--usagelimit** / **-u**: Flag. Display your DeepL API key's usage limit after use.