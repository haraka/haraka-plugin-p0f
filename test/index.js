// node.js built-in modules
const assert = require('node:assert')

// npm modules
const fixtures = require('haraka-test-fixtures')

beforeEach(() => {
  this.plugin = new fixtures.plugin('p0f')

  // replace vm-compiled functions with instrumented versions for coverage tracking
  if (process.env.HARAKA_COVERAGE) {
    const plugin_module = require('../index.js')
    Object.assign(this.plugin, plugin_module)
  }
})

describe('p0f', () => {
  it('loads', () => {
    assert.ok(this.plugin)
  })
})

describe('load_p0f_ini', () => {
  it('loads p0f.ini from config/p0f.ini', () => {
    this.plugin.load_p0f_ini()
    assert.ok(this.plugin.cfg)
  })
})

describe('lookup_rdns', () => {
  it.skip('retrieves TCP fingerprint data from p0f server', () => {
  })
})

describe('data_post', () => {
  beforeEach(() => {
    this.plugin = new fixtures.plugin('p0f')
    this.plugin.load_p0f_ini()
    this.plugin.cfg.main.add_header = 'X-p0f-Result'
    this.connection = new fixtures.connection.createConnection()
    this.connection.init_transaction()
    this.connection.results.add(
      { name: 'p0f' },
      { os_name: 'BeOS', os_flavor: 'forever' },
    )
  })

  it('adds a header when data exists', async () => {
    await new Promise((resolve) => {
      this.plugin.add_p0f_header((code, value) => {
        assert.ok(Object.keys(this.connection.transaction.header.headers))
        resolve()
      }, this.connection)
    })
  })

  it('ignores private IPs', async () => {
    this.connection.remote.is_private = true
    await new Promise((resolve) => {
      this.plugin.add_p0f_header((code, value) => {
        assert.equal(code, undefined)
        assert.equal(value, undefined)
        assert.equal(Object.keys(this.connection.transaction.header.headers), 0)
        resolve()
      }, this.connection)
    })
  })
})
