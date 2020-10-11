var wordcount = require('wordcount');

class Entry {
  constructor(text) {
    if (!text) return;
    const entryLines = text.split(/\r?\n/)
    this.lineNumber = entryLines[0];
    this.ts = entryLines[1];
    this.lines = entryLines.slice(2);
    this.total = this.lines.join(' ');
    this.wordCount = wordcount(this.total);
  }

  toText() {
    let text = this.lineNumber + '\n' +
      this.ts + '\n';
    for (let line of this.lines) {
      text += line + '\n';
    }
    text += '\n';
    return text;
  }
}

module.exports = Entry;