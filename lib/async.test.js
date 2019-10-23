const { expect } = require('chai');
const { DATA_TYPES } = require('../test/util');
const { cartesian, range } = require('./common');

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
                    setTimeout(() => resolve(callback(...args)), Math.random() * 25);
                });
            });
            expect(callbacks.length).to.equal(asyncCallbacks.length);

            async function test(string, search, callback) {
                const syncReplaced = string.replace(search, callbacks[callback]);
                const asyncReplaced = await replace(string, search, asyncCallbacks[callback]);
                expect(syncReplaced).to.equal(asyncReplaced);
            }

            const tests = cartesian(strings, searches, range(callbacks.length))
                .map(([ st, se, cb ]) => test(st, se, cb));
            await Promise.all(tests);
        });
    });

    describe('wait', function() {
        it('should resolve after the specified amount of ms', async function() {
            await Promise.all(Array.from({ length: 10 }, async() => {
                const callTime = new Date().getTime();
                const waitTime = Math.round(Math.random() * 20 + 5);

                await wait(waitTime);
                const resolvedTime = new Date().getTime();

                expect(
                    resolvedTime - callTime,
                    `did not resolve after ${waitTime}ms`,
                ).to.be.within(waitTime - 1, waitTime + 1); // even setTimeout seems to have some buffer
            }));
        });

        it('should resolve with the specified returnValue', async function() {
            await Promise.all(DATA_TYPES.map(async(value) => {
                const resolvedValue = await wait(Math.random() * 10, value);
                expect(resolvedValue).to.equal(value);
            }));
        });
    });
};
