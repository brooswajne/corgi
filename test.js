const corgi = require('./index');
const { Templater, RenderError } = corgi;

const async = require('./util/async');

const json = {
    documents: [
        {
            name: 'document one.docx',
        },
        {
            name: 'document two.docx',
        },
        {
            name: 'document three.docx',
        },
    ],
};
async function parser(property, /* { scope, cache } */) {
    const time = Math.round(Math.random() * 1000);
    // console.time(`parsing, waiting ${time}`);
    await async.wait(time);
    // console.timeEnd(`parsing, waiting ${time}`);

    if (property.trim()[0] === '/') return corgi.block.close(property.trim().substring(1));

    const path = property.split(' ')
        .map(s => s.trim())
        .filter(s => s);

    const obj = path.reduce((prev, p) => {
        if (typeof prev === 'undefined') return prev;
        return prev[p];
    }, json);
    if (obj instanceof Array) return corgi.block.open(property.trim(), obj);
    return corgi.data(obj);
}

const templater = new Templater(parser, {
    log: 4,
});

// const { readFile } = require('./lib/common/files');
async function test() {
    await templater.render('./test/files/Templatr Test Sheet.xlsx');
    // await templater.render(await readFile('./test/xlsx/Templatr Test Sheet.xlsx'), 'xlsx');
}

test().catch(err => {
    if (err instanceof RenderError) console.error(err.toString());
    else console.error(err);
});
