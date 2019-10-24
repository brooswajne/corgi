async function map(arr, ...args) {
    const mapped = await Promise.all(arr.map(...args));
    return mapped;
}
map.series = async(arr, mapper, thisArg) => {
    const mapped = [];
    for (let idx = 0; idx < arr.length; idx++) {
        mapped.push(await mapper.call(thisArg, arr[idx], idx));
    }
    return mapped;
};

async function replace(string, search, callback, {
    series = false,
} = {}) {
    const callbackArgs = [];
    string.replace(search, (...args) => {
        callbackArgs.push(args);
    });

    const replacements = series
        ? await map.series(callbackArgs, (args) => callback(...args))
        : await map(callbackArgs, (args) => callback(...args));
    let idx = 0;
    return string.replace(search, () => replacements[idx++]);
}
function wait(ms, returnValue) {
    return new Promise((resolve) => setTimeout(() => resolve(returnValue), ms));
}

module.exports = { replace, wait };
