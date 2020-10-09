class Entry {
  constructor(text) {
    const entryLines = text.split('\n');
    this.lineNumber = entryLines[0];
    this.ts = entryLines[1];
    this.lines = entryLines.slice(2);
  }
}

module.exports = Entry;