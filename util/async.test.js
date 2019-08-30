const { expect } = require('chai');

module.exports = function({ replace }) {
    describe('replace', function() {
        it('should give the same output as string.replace', async function() {
            const strings = [
                'foo bar fizz foo fizz baz fizz lol foo foo',
                'flooblilafoobarfoo#@640-ad]c foas=1',
            ];
            const searches = [
                /f(o)o/g,
                /(o+|a)/g,
            ];
            const callbacks = [
                (match, group) => group.toUpperCase(),
            ];
            for (const string of strings) {
                for (const search of searches) {
                    for (const callback of callbacks) {
                        const asyncCallback = function(...args) {
                            return new Promise((resolve) => {
                                setTimeout(() => resolve(callback(...args)), 1);
                            });
                        };
                        const syncReplaced = string.replace(search, callback);
                        const asyncReplaced = await replace(string, search, asyncCallback);
                        // console.log({ syncReplaced, asyncReplaced });
                        expect(syncReplaced).to.equal(asyncReplaced);
                    }
                }
            }
        });
    });
};
