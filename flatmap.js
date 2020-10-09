const concat = (x, y) => x.concat(y);

const flatMap = (f, xs) => xs.map(f).reduce(concat, []);

if (Array.prototype.flatMap === undefined) {
  Array.prototype.flatMap = function(f) {
    return flatMap(f, this);
  }
}
