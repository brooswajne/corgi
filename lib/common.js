const fs = require('fs');

function* rangeIterator(start = Math.floor(Math.random() * 100), end) {
    if (end === undefined) {
        end = start;
        start = 0;
    }
    for (let i = start; i < end; i++) yield i;
}

function* cartesianIterator(...iterators) {
    if (!iterators.length) /* do nothing */;
    else if (iterators.length === 1) {
        for (const a of iterators[0]) yield [ a ];
    } else {
        const last = iterators.pop();
        for (const product of cartesianIterator(...iterators)) {
            for (const a of last) yield product.concat(a);
        }
    }
}

module.exports = {
    cartesian: (...args) => Array.from(cartesianIterator(...args)),
    cartesianIterator,
    constructArray: (length, entries) => Array.from({ length }, (value, idx) => entries(idx)),
    isObject(obj) {
        return typeof obj === 'object'
            && obj !== null
            && obj.constructor === Object;
    },
    numericalOrdering: (a, b) => a - b,
    range: (...args) => Array.from(rangeIterator(...args)),
    rangeIterator,
    readFile(...args) {
        return new Promise((resolve, reject) => {
            fs.readFile(...args, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    },
    stringToRegex: (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    unique(by) { // gets a Array.prototype.filter() or Array.prototype.reduce() callback which will unique-ify the array
        if (typeof by === 'undefined') by = (elt) => elt;
        else if (typeof by === 'string') {
            const key = by;
            by = (elt) => elt[key];
        }

        if (typeof by !== 'function') throw new Error('Unique reducer must be a function');

        const uniqueElements = new Map();
        const uniquifier = (...args) => {
            const isReduce = args.length === 4;
            const [ elt, idx, array ] = isReduce ? args.slice(1) : args;

            if (isReduce && idx === 1) { // add first element which would be skipped by reduce
                const byValue = by(array[0], 0);
                if (!uniqueElements.has(byValue)) uniqueElements.set(byValue, 0);
            }

            const byValue = by(elt, idx);
            if (!uniqueElements.has(byValue)) uniqueElements.set(byValue, idx);

            return isReduce
                ? Array.from(uniqueElements.values()).map(idx => array[idx])
                : uniqueElements.get(byValue) === idx;
        };

        uniquifier.reset = () => uniqueElements.clear();
        uniquifier.inspect = () => new Map(uniqueElements);

        return uniquifier;
    },
    writeFile(...args) {
        return new Promise((resolve, reject) => {
            fs.writeFile(...args, (err) => {
                if (err) reject(err);
                else resolve(args[0]);
            });
        });
    },
};
