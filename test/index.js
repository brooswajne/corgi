const fs = require('fs');
const path = require('path');

const TEST_DIR = path.join(__dirname, './spec');

function testDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);

        if (fs.statSync(filePath).isDirectory()) {
            testDir(filePath);
        } else if (path.extname(file) === '.js') {
            const testName = path.relative(TEST_DIR, filePath);
            const testTarget = path.join(__dirname, '../'+testName);
            describe(testName, function() {
                require(filePath)(require(testTarget));
            });
        }
    });
}

testDir(TEST_DIR);
