const path = require('path');
const fs = require('fs');
const { expect } = require('chai');

const {
    dependencies = {},
    name, version, description, keywords, author,
    main,
} = require('./package.json');

module.exports = function(index) {
    it('should have the expected exports', function() {
        expect(Object.keys(index)).to.have.members([
            'Templater',
            'Errors',
            'block',
            'data',
        ]);
    });

    it('should have only absolutely required dependencies', function() {
        expect(dependencies).to.have.keys([ 'jszip' ]);
    });

    it('should have meta fields set', function() {
        expect(name, 'name is not set').to.be.ok;
        expect(version, 'version is not set').to.be.ok;
        expect(version.split('.'), 'version is formatted incorrectly').to.have.length(3);
        expect(description, 'description is not set').to.be.ok;
        expect(keywords, 'keywords is empty').to.not.be.empty;
        expect(author, 'author is not set').to.be.ok;
    });

    it('should point to a valid js file as entry point', function() {
        const entry = path.join(__dirname, main);
        expect(path.extname(entry), 'is not a js file').to.equal('.js');

        const stats = fs.statSync(entry); // will throw if does not exist
        expect(stats.isDirectory()).to.be.false;
    });
};
