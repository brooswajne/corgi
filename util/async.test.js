const { expect } = require('chai');

module.exports = function({ replace, wait }) {
    describe('replace', function() {
        it('should give the same output as string.replace', async function() {
            const strings = [
                'foo bar fizz foo fizz baz fizz lol foo foo',
                'flooblilafoobarfoo#@640-ad]c foas=1',
            ];
            const searches = [
                /f(o)o/g,
                /(o+|a)/g,
                'ba',
            ];
            const callbacks = [
                (match, group) => group
                    .toString() // when `search` is a string, second arg is the offset idx
                    .toUpperCase() + match,
                (match) => 'replaced:'+match+':replaced',
            ];
            const asyncCallbacks = callbacks.map((callback) => function(...args) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve(callback(...args)), Math.random() * 10);
                });
            });
            expect(callbacks.length).to.equal(asyncCallbacks.length);

            async function test(string, search, callback) {
                const syncReplaced = string.replace(search, callbacks[callback]);
                const asyncReplaced = await replace(string, search, asyncCallbacks[callback]);

                expect(syncReplaced).to.equal(asyncReplaced);
            }

            const tests = [];
            for (const string of strings) {
                for (const search of searches) {
                    for (let cb = 0; cb < callbacks.length; cb++) {
                        tests.push(test(string, search, cb));
                    }
                }
            }
            await Promise.all(tests);
        });
    });

    describe('wait', function() {
        it('should resolve after the specified amount of ms', async function() {
            const callTime = new Date().getTime();
            const waitTime = Math.round(Math.random() * 10);
            await wait(waitTime);
            const resolveTime = new Date().getTime();
            expect(resolveTime).to.equal(callTime + waitTime);
        });

        it('should resolve with the specified returnValue', async function() {
            const resolveValue = { foo : 'bar' };
            const resolvedValue = await wait(Math.random() * 10, resolveValue);
            expect(resolvedValue).to.equal(resolveValue);
        });
    });
};
