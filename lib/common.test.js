const { expect } = require('chai');

const itIsAnIterator = (target) => it('should be an iterator', function() {
    expect(typeof target).to.equal('object');
    expect(typeof target.next).to.equal('function');
    expect(() => [ ...target ]).to.not.throw();
    return true;
});

module.exports = function({
    cartesian,
    cartesianIterator,
    isObject,
    numericalOrdering,
    range,
    rangeIterator,
    unique,
}) {
    describe('cartesian', function() {
        it('should return the cartesian product of passed arrays', function() {
            expect(cartesian([ 'foo', 'bar', 'fizz' ], [ 1, 2 ])).to.have.deep.members([
                [ 'foo', 1 ],
                [ 'foo', 2 ],
                [ 'bar', 1 ],
                [ 'bar', 2 ],
                [ 'fizz', 1 ],
                [ 'fizz', 2 ],
            ]);
            expect(cartesian([ 'a', 'b' ], [ 1, 2 ], [ 'foo', 'bar' ])).to.have.deep.members([
                [ 'a', 1, 'foo' ],
                [ 'a', 1, 'bar' ],
                [ 'a', 2, 'foo' ],
                [ 'a', 2, 'bar' ],
                [ 'b', 1, 'foo' ],
                [ 'b', 1, 'bar' ],
                [ 'b', 2, 'foo' ],
                [ 'b', 2, 'bar' ],
            ]);
        });
        it('should return an empty array when no arguments are passed', function() {
            expect(cartesian()).to.have.length(0);
        });
    });
    describe('cartesianIterator', function() {
        itIsAnIterator(cartesianIterator([ 1, 2 ], [ 3, 4 ]));
        it('should return the cartesian product of passed arrays', function() {
            expect(Array.from(cartesianIterator([ 'foo', 'bar', 'fizz' ], [ 1, 2 ]))).to.have.deep.members([
                [ 'foo', 1 ],
                [ 'foo', 2 ],
                [ 'bar', 1 ],
                [ 'bar', 2 ],
                [ 'fizz', 1 ],
                [ 'fizz', 2 ],
            ]);
            expect(Array.from(cartesianIterator([ 'a', 'b' ], [ 1, 2 ], [ 'foo', 'bar' ]))).to.have.deep.members([
                [ 'a', 1, 'foo' ],
                [ 'a', 1, 'bar' ],
                [ 'a', 2, 'foo' ],
                [ 'a', 2, 'bar' ],
                [ 'b', 1, 'foo' ],
                [ 'b', 1, 'bar' ],
                [ 'b', 2, 'foo' ],
                [ 'b', 2, 'bar' ],
            ]);
        });
        it('should return an empty array when no arguments are passed', function() {
            expect(Array.from(cartesianIterator())).to.have.length(0);
        });
    });

    describe('isObject', function() {
        it('should identify plain objects', function() {
            expect(isObject({})).to.be.true;
            // arent objects
            expect(isObject('foo')).to.be.false;
            expect(isObject(1)).to.be.false;
            expect(isObject(true)).to.be.false;
            // inherit from object, but aren't plain objects
            expect(isObject([])).to.be.false;
            expect(isObject(new Date())).to.be.false;
            const customClass = function() {};
            expect(isObject(new customClass())).to.be.false;
            expect(isObject(customClass)).to.be.false;
        });
    });

    describe('numericalOrdering', function() {
        it('should sort arrays of numbers correctly', function() {
            expect([ 3, 2, 10, 11, 1 ].sort()).to.deep
                .equal([ 1, 10, 11, 2, 3 ]);
            expect([ 3, 2, 10, 11, 1 ].sort(numericalOrdering)).to.deep
                .equal([ 1, 2, 3, 10, 11 ]);
        });
    });

    describe('range', function() {
        it('should be an array of all numbers between start/end', function() {
            expect(range(0, 3)).to.deep
                .equal([ 0, 1, 2 ]);
            expect(range(10, 15)).to.deep
                .equal([ 10, 11, 12, 13, 14 ]);
        });
        it('should accept a single argument and default to start being 0', function() {
            expect(range(3)).to.deep
                .equal([ 0, 1, 2 ]);
        });
        it('should return a random length range if no arguments passed', function() {
            expect(range()).to.have.length.lt(100);
        });
    });
    describe('rangeIterator', function() {
        itIsAnIterator(rangeIterator(0, 3));

        it('should iterate through all numbers between start/end', function() {

            expect(Array.from(rangeIterator(0, 3))).to.deep
                .equal([ 0, 1, 2 ]);
            expect(Array.from(rangeIterator(10, 15))).to.deep
                .equal([ 10, 11, 12, 13, 14 ]);
        });
        it('should accept a single argument and default to start being 0', function() {
            expect(Array.from(range(3))).to.deep
                .equal([ 0, 1, 2 ]);
        });
        it('should return a random length range if no arguments passed', function() {
            expect(Array.from(rangeIterator())).to.have.length.lt(100);
        });
    });

    describe('unique', function() {
        const numbers = [0, 1, 1, 4, 5];
        const strings = ['foo', 'bar', 'foo'];
        const objects = [numbers, { fizz: 'buzz' }, { fizz: 'buzz' }, numbers, numbers, strings];
        const mixed = [undefined, null, 0, 'foo', 'foo', undefined, null, objects];

        it('should work as a Array.prototype.filter() iteratee', function() {
            const numbersUnique = numbers.filter(unique());
            expect(numbersUnique).to.have.members([0, 1, 4, 5]);
            const stringsUnique = strings.filter(unique());
            expect(stringsUnique).to.have.members(['foo', 'bar']);
            const objectsUnique = objects.filter(unique());
            expect(objectsUnique).to.have.members([numbers, objects[1], objects[2], strings]);
            const mixedUnique = mixed.filter(unique());
            expect(mixedUnique).to.have.members([undefined, null, 0, 'foo', objects]);
        });

        it('should work as a Array.prototype.reduce() iteratee', function() {
            const numbersUnique = numbers.reduce(unique());
            expect(numbersUnique).to.have.members([0, 1, 4, 5]);
            const stringsUnique = strings.reduce(unique());
            expect(stringsUnique).to.have.members(['foo', 'bar']);
            const objectsUnique = objects.reduce(unique());
            expect(objectsUnique).to.have.members([numbers, objects[1], objects[2], strings]);
            const mixedUnique = mixed.reduce(unique());
            expect(mixedUnique).to.have.members([undefined, null, 0, 'foo', objects]);
        });

        it('should be able to unique by a mapper argument', function() {
            expect(numbers.reduce(unique(n => n % 2))).to.have.members([0, 1]);
            expect(numbers.filter(unique(n => n % 2))).to.have.members([0, 1]);

            let idx = 0;
            expect(strings.reduce(unique(n => idx++))).to.have.members(['foo', 'bar', 'foo']);
            expect(strings.filter(unique(n => idx++))).to.have.members(['foo', 'bar', 'foo']);

            expect(mixed.filter(unique(n => n == undefined))).to.have.members([undefined, 0]);
            expect(mixed.reduce(unique(n => n == undefined))).to.have.members([undefined, 0]);
        });

        it('should be able to filter by object property', function() {
            expect(objects.filter(unique('fizz'))).to.have.members([numbers, objects[1]]);
        });
    });
};
