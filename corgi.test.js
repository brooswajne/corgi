const { expect } = require('chai');

module.exports = function(index) {
    it('should have the expected exports', function() {
        expect(Object.keys(index)).to.have.members([
            'Templater',
            'Errors',
            'block',
            'data',
        ]);
    });
};
