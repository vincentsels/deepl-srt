class Entry {
  constructor(text) {
    if (!text) return;
    const entryLines = text.split(/\r?\n/)
    this.number = entryLines[0];
    this.ts = entryLines[1];
    this.lines = entryLines.slice(2);
    this.total = this.lines.join(' ');
    this.characterCount = this.total.length;
  }

  toText() {
    let text = this.number + '\n' +
      this.ts + '\n';
    for (let line of this.lines) {
      text += line + '\n';
    }
    text += '\n';
    return text;
  }
}

module.exports = Entry;