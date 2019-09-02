const { expect } = require('chai');

module.exports = function({ unique }) {
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
