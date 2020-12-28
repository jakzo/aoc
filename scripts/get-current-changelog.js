const path = require('path')
const fs = require('fs')
const { getChangelogEntry } = require('@changesets/release-utils')

const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8')
const version = require('../package.json').version
console.log(getChangelogEntry(changelog, version).content)
