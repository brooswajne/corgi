// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures
const PRIMITIVES = [
    true, // Boolean type
    null, // Null type
    undefined, // Undefined type
    123, // Number type
    //? BigInt ?
    'foo', // String type
    Symbol('foo'), // Symbol type
];
const OBJECTS = [
    { 'foo': 'bar' },
    new Date(),
    [ 1, 2, 3 ],
    new Map(),
    new Set(),
    new WeakMap(),
    new WeakSet(),
];

module.exports = {
    PRIMITIVES,
    OBJECTS,
    DATA_TYPES: [
        ...PRIMITIVES,
        ...OBJECTS,
    ],
};
