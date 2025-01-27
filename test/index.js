// node.js built-in modules
const assert = require('node:assert')

// npm modules
const fixtures = require('haraka-test-fixtures')

beforeEach((done) => {
  this.plugin = new fixtures.plugin('p0f')
  done()
})

describe('p0f', () => {
  it('loads', (done) => {
    assert.ok(this.plugin)
    done()
  })
})

describe('load_p0f_ini', () => {
  it('loads p0f.ini from config/p0f.ini', (done) => {
    this.plugin.load_p0f_ini()
    assert.ok(this.plugin.cfg)
    done()
  })
})

describe('lookup_rdns', () => {
  it.skip('retrieves TCP fingerprint data from p0f server', (done) => {
    done()
  })
})

describe('data_post', () => {
  beforeEach((done) => {
    this.plugin = new fixtures.plugin('p0f')
    this.plugin.load_p0f_ini()
    this.plugin.cfg.main.add_header = 'X-p0f-Result'
    this.connection = new fixtures.connection.createConnection()
    this.connection.init_transaction()
    this.connection.results.add(
      { name: 'p0f' },
      { os_name: 'BeOS', os_flavor: 'forever' },
    )
    done()
  })

  it('adds a header when data exists', (done) => {
    this.plugin.add_p0f_header((code, value) => {
      assert.ok(Object.keys(this.connection.transaction.header.headers))
      done()
    }, this.connection)
  })

  it('ignores private IPs', (done) => {
    this.connection.remote.is_private = true
    this.plugin.add_p0f_header((code, value) => {
      assert.equal(code, undefined)
      assert.equal(value, undefined)
      assert.equal(Object.keys(this.connection.transaction.header.headers), 0)
      done()
    }, this.connection)
  })
})
