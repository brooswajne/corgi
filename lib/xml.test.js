const { expect } = require('chai');

module.exports = function({
    parseXMLTag,
    getXMLTagRegex,
    setXMLTagAttributes,
}) {
    describe('parseXMLTag', function() {
        const TAGS = {
            '<foo>bar</foo>': {
                opener: '<foo>',
                contents: 'bar',
                closer: '</foo>',
                name: 'foo',
                attributes: {},
                selfClosing: false,
            },
            '<  foo>b3290p8231\'asdfp</ foo      >': {
                opener: '<  foo>',
                contents: 'b3290p8231\'asdfp',
                closer: '</ foo      >',
                name: 'foo',
                attributes: {},
                selfClosing: false,
            },
            '<name attr1="bar" attr2="fizz">contents\nwowowow</name>': {
                opener: '<name attr1="bar" attr2="fizz">',
                contents: 'contents\nwowowow',
                closer: '</name>',
                name: 'name',
                attributes: {
                    'attr1': 'bar',
                    'attr2': 'fizz',
                },
                selfClosing: false,
            },
            // self closing tags
            '<selfclosing />': {
                opener: '<selfclosing />',
                contents: '',
                closer: '<selfclosing />',
                name: 'selfclosing',
                attributes: {},
                selfClosing: true,
            },
            '<selfclosing2 attr="foo" />': {
                opener: '<selfclosing2 attr="foo" />',
                contents: '',
                closer: '<selfclosing2 attr="foo" />',
                name: 'selfclosing2',
                attributes: { 'attr': 'foo' },
                selfClosing: true,
            },
            // escaped characters
            '<foo a="one&amp;two&quot;three">&apos;bar&lt;&gt;</foo>': {
                opener: '<foo a="one&amp;two&quot;three">',
                contents: '\'bar<>',
                closer: '</foo>',
                name: 'foo',
                attributes: { 'a': 'one&two"three' },
                selfClosing: false,
            },
        };

        it('should parse tag names', function() {
            for (const tag in TAGS) expect(parseXMLTag(tag).name).to
                .equal(TAGS[tag].name);
        });
        it('should parse tag attributes', function() {
            for (const tag in TAGS) expect(parseXMLTag(tag).attributes).to
                .deep.equal(TAGS[tag].attributes);
        });
        it('should split the tag into opener/contents/closer', function() {
            for (const tag in TAGS) {
                const { opener, contents, closer } = parseXMLTag(tag);
                expect(opener).to.equal(TAGS[tag].opener);
                expect(contents).to.equal(TAGS[tag].contents);
                expect(closer).to.equal(TAGS[tag].closer);
            }
        });
        it('should identify whether a tag is self-closing', function() {
            for (const tag in TAGS) expect(parseXMLTag(tag).selfClosing).to
                .equal(TAGS[tag].selfClosing);
        });
    });

    describe('getXMLTagRegex', function() {
        it('should return a regex', function() {
            expect(getXMLTagRegex('foo')).to
                .be.instanceof(RegExp);
        });
        it('should match the appropriate xml tag', function() {
            const regex = getXMLTagRegex('foo');
            expect('<foo>bar</foo>'.match(regex)).to
                .have.length(1);
            expect('<foo a="b" c="d">bar</foo>'.match(regex)).to
                .have.length(1);
            expect('<foo>bar</foo><foo>buzz</foo>'.match(regex)).to
                .have.length(2);
            expect('<  foo>3245-=0vdssa1<    /  foo >'.match(regex)).to
                .have.length(1);
            expect('<foo />'.match(regex)).to
                .have.length(1);
            expect('<   foo attr="dsfglksdalk" />'.match(regex)).to
                .have.length(1);
        });
    });

    describe('setXMLTagAttributes', function() {
        it('should correctly set the tag\'s attributes', function() {
            expect(setXMLTagAttributes('<foo>bar    < / foo>', {
                attr1: 'blah',
                attr2: 'bloh',
            })).to.equal('<foo attr1="blah" attr2="bloh">bar    < / foo>');
            expect(setXMLTagAttributes('<foo a="1" b="2">bar</foo>', {
                b: '3',
                c: '2',
            })).to.equal('<foo a="1" b="3" c="2">bar</foo>');
        });
        it('should not add a space if no attributes are passed', function() {
            expect(setXMLTagAttributes('<foo>bar</foo>', {}))
                .to.equal('<foo>bar</foo>');
        });
        it('should correctly escape characters', function() {
            expect(setXMLTagAttributes('<foo a="&amp;amp;">bar</foo>', {
                b: '<>',
                c: 'wow"\'wow',
            })).to.equal('<foo a="&amp;amp;" b="&lt;&gt;" c="wow&quot;&apos;wow">bar</foo>');
        });
    });
};
