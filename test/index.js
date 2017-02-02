
// node.js built-in modules
const assert   = require('assert');

// npm modules
const fixtures = require('haraka-test-fixtures');

// start of tests
//    assert: https://nodejs.org/api/assert.html
//    mocha: http://mochajs.org

beforeEach(function (done) {
    this.plugin = new fixtures.plugin('p0f');
    done();  // if a test hangs, assure you called done()
});

describe('p0f', function () {
    it('loads', function (done) {
        assert.ok(this.plugin);
        done();
    });
});

describe('load_p0f_ini', function () {
    it('loads p0f.ini from config/p0f.ini', function (done) {
        this.plugin.load_p0f_ini();
        assert.ok(this.plugin.cfg);
        done();
    });
});
