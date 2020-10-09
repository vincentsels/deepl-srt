class Entry {
  constructor(text) {
    const entryLines = text.split(/\r?\n/)
    this.lineNumber = entryLines[0];
    this.ts = entryLines[1];
    this.lines = entryLines.slice(2);
    this.total = this.lines.join(' ');
  }
}

module.exports = Entry;