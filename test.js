const fs = require('fs');
const path = require('path');
const ignore = require('ignore')();

const IGNORED_FILES = fs.readFileSync(path.join(__dirname, '.gitignore'), { encoding: 'utf-8' })
    .split('\n');
ignore.add(IGNORED_FILES);
ignore.add(['.git']);

(function testDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        const relativePath = path.relative(__dirname, filePath);

        if (ignore.ignores(relativePath)) return;

        if (fs.statSync(filePath).isDirectory()) {
            testDir(filePath);
        } else if (file.endsWith('.test.js')) {
            // const testTarget = path.join(__dirname, '../'+testName);
            const testTarget = filePath.replace(/\.test\.js$/, '.js');
            const testName = path.relative(__dirname, testTarget);
            console.log({ filePath, testName, testTarget });
            describe(testName, function() {
                require(filePath)(require(testTarget));
            });
        }
    });
})(__dirname);
