const path = require('path')
const { default: getReleasePlan } = require('@changesets/get-release-plan')
const chalk = require('chalk')

const main = async () => {
  try {
    const releasePlan = await getReleasePlan(path.join(__dirname, '..'), 'master')
    const hasChangeset = releasePlan.changesets.length > 0
    if (!hasChangeset) return
    console.log(chalk.yellow('No changeset found. Creating one now...'))
    process.exit(1)
  } catch (err) {
    console.error(err)
    console.error(chalk.red('Failed to check changeset. Ignoring error and continuing...'))
  }
}

if (require.main === module) void main()
