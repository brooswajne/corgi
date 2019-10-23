async function replace(string, search, callback) {
    const promises = [];
    string.replace(search, (...args) => {
        promises.push(callback(...args));
    });

    const replacements = await Promise.all(promises);
    let idx = 0;
    return string.replace(search, () => replacements[idx++]);
}
function wait(ms, returnValue) {
    return new Promise((resolve) => setTimeout(() => resolve(returnValue), ms));
}

module.exports = { replace, wait };
