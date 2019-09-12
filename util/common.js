const fs = require('fs');

module.exports = {
    isObject(obj) {
        return typeof obj === 'object'
            && obj !== null
            && obj.constructor === Object;
    },
    numericalOrdering: (a, b) => a - b,
    readFile(...args) {
        return new Promise((resolve, reject) => {
            fs.readFile(...args, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    },
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
};
