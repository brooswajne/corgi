const { expect } = require('chai');

module.exports = function({
    columnToNumber,
    numberToColumn,
    columnRange,
}) {
    describe('excel helper functions', function() {
        const columnMap = {
            'A': 1, 'B': 2, 'Z': 26,
            'AA': 27, 'AB': 28,
            'ABA': 729,
        };
        describe('columnToNumber', function() {
            it('should return the correct values', function() {
                Object.keys(columnMap).forEach(col => {
                    expect(columnToNumber(col)).to.equal(columnMap[col]);
                });
            });
            it('should return -1 for invalid input', function() {
                [undefined, null, '', -1, 10].forEach(input => {
                    expect(columnToNumber(input)).to.equal(-1);
                });
            });
        });
        describe('numberToColumn', function() {
            it('should return the correct columns', function() {
                Object.keys(columnMap).forEach(col => {
                    expect(numberToColumn(columnMap[col])).to.equal(col);
                });
            });
        });
        describe('columnRange', function() {
            it('should return all columns in between the passed arguments', function() {
                expect(columnRange('A', 'D')).to.have.members(['A', 'B', 'C', 'D']);
                expect(columnRange('T', 'AD')).to.have.members([
                    'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
                    'AA', 'AB', 'AC', 'AD',
                ]);
            });
            it('should adjust for bounds being in incorrect order', function() {
                expect(columnRange('D', 'A')).to.have.members(['A', 'B', 'C', 'D']);
                expect(columnRange('AD', 'T')).to.have.members([
                    'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
                    'AA', 'AB', 'AC', 'AD',
                ]);
            });
        });
    });
};
