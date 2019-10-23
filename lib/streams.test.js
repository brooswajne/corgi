const { testTransformStreams, ChunkSplitter } = require('../test/streams');

module.exports = function({ XMLTagReplacer }) {
    describe('XMLTagReplacer', function() {
        it('should find an xml tag and replace its contents', function() {
            testTransformStreams([XMLTagReplacer('foo', 'REPLACED')],
                '<foo>contents</foo>',
                '<foo>REPLACED</foo>');
            testTransformStreams([XMLTagReplacer('foo', 'REPLACED')],
                '<bar><foo>contents</foo></bar>',
                '<bar><foo>REPLACED</foo></bar>');
            testTransformStreams([XMLTagReplacer('foo', 'REPLACED')],
                '<foo><bar>contents</bar></foo>',
                '<foo>REPLACED</foo>');
        });
        it('should replace tags split across multiple lines', function() {
            testTransformStreams([XMLTagReplacer('foo', 'REPLACED')],
                '<foo>\ncontents\nsecond line\n</foo>',
                '<foo>REPLACED</foo>');
        });
        it('should deal with split chunks', function() {
            testTransformStreams([ChunkSplitter(1), XMLTagReplacer('foo', 'REPLACED')],
                '<foo>contents</foo>',
                '<foo>REPLACED</foo>');
        });
        it('should replace multiple tags if found', function() {
            testTransformStreams([XMLTagReplacer('foo', 'REPLACED')],
                '<bar><foo>contents 1</foo></bar>\n<foo>contents 2</foo><foo>contents 3</foo>',
                '<bar><foo>REPLACED</foo></bar>\n<foo>REPLACED</foo><foo>REPLACED</foo>');
        });
    });
};
