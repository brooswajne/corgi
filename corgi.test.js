const path = require('path');
const fs = require('fs');
const { expect } = require('chai');

const ERROR_CLASSES = require('./errors');
const {
    name, version, description, keywords, author,
    main,
} = require('./package.json');

module.exports = function(corgi) {
    describe('the module', function() {
        it('should be a templater constructor', function() {
            expect(typeof corgi, 'is not function type').to.equal('function');
            expect(new corgi(() => null)).to.be.instanceof(corgi);

            const { Templater } = corgi;
            expect(Templater, 'no circular reference for named imports').to.equal(corgi);
        });
        it('should export all error classes', function() {
            for (const cls in ERROR_CLASSES) {
                expect(cls in corgi, `${cls} not included`).to.be.true;
                expect(corgi[cls], `corgi.${cls} doesn't match`).to.equal(ERROR_CLASSES[cls]);
            }
        });
        it('should export identifier type helpers', function() {
            expect('data' in corgi).to.be.true;
            expect(typeof corgi.data).to.equal('function');

            expect('block' in corgi).to.be.true;
            expect(Object.keys(corgi.block)).to.have.members([
                'open',
                'close',
            ]);
            for (const k in corgi.block) expect(typeof corgi.block[k]).to.equal('function');
        });
    });

    describe('the package', function() {
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
    });
};
