import cheerio from 'cheerio'
import { formatDistanceToNowStrict } from 'date-fns'
import keytar from 'keytar'
import fse from 'fs-extra'
import chokidar from 'chokidar'
import { spawn } from 'child_process'
import inquirer from 'inquirer'
import path from 'path'
import chalk from 'chalk'
import tempy from 'tempy'

import {
  getCurrentDay,
  getCurrentYear,
  validateDayAndYear,
  makeRequest,
  getSessionToken,
  DEFAULT_ACCOUNT,
  KEYTAR_SERVICE_NAME,
  padZero,
  getCurrentChallengeStartTime,
  normalizeTemplate,
  getDirForDay,
  logHtml,
  getChallengeStartTime,
} from './utils'
import { AocTemplate, CommandBuilder } from './templates'

export const main = async (
  year = getCurrentChallengeStartTime().getUTCFullYear(),
  day = getCurrentChallengeStartTime().getUTCDate(),
  account?: string,
) => {
  await getSessionToken(account, true)
  await countdownToStart(undefined, getChallengeStartTime(year, day).getTime())
  // TODO: Continue to part 2 if part 1 is already completed
  let part = 1
  await printDescription(year, day, part, account)
  const dir = getDirForDay(day)
  await fse.ensureDir(dir)
  await fse.writeFile(path.join(dir, 'input.txt'), await getInput(year, day))
  while (true) {
    while (true) {
      console.log('')
      const { answer } = await inquirer.prompt<{ answer: string }>([
        { name: 'answer', message: 'Enter your answer:' },
      ])
      const { isCorrect, isDone } = await submit(part, answer, day, year, true, account)
      if (isCorrect) {
        const wipRegex = /\bwip\b/i
        for (const filename of await fse.readdir(dir)) {
          if (!wipRegex.test(filename)) continue
          await fse.copy(
            path.join(dir, filename),
            path.join(dir, filename.replace(wipRegex, `part${part}`)),
          )
        }
        if (isDone) return
        part++
        break
      }
    }
    await printDescription(year, day, part, account)
  }
}

export const start = async (template: AocTemplate = 'js', day = getCurrentDay()) => {
  const dir = getDirForDay(day)
  const normalizedTemplate = normalizeTemplate(template)
  await copyTemplates(dir, normalizedTemplate.path)
  return runAndWatch(normalizedTemplate.commandBuilder, dir, normalizedTemplate.files)
}

export const loginPrompt = async (account = DEFAULT_ACCOUNT) => {
  await keytar.deletePassword(KEYTAR_SERVICE_NAME, account)
  await getSessionToken(account, true)
}

export const copyTemplates = async (outputPath: string, templatePath: string) => {
  await fse.copy(templatePath, outputPath, { overwrite: false })
}

// TODO: Synchronize with AoC time
export const countdownToStart = async (
  margin = 1000 * 60 * 60 * 23,
  startTime = getCurrentChallengeStartTime(margin).getTime(),
) =>
  new Promise<void>(resolve => {
    const tick = () => {
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
      const now = Date.now()
      if (now >= startTime) {
        console.log('Challenge starting now!')
        resolve()
      } else {
        process.stdout.write(`Challenge starts in ${formatDistanceToNowStrict(startTime + 500)}`)
        // Align the ticks to the startTime
        setTimeout(tick, 1000 - (((now % 1000) - (startTime % 1000) + 1000) % 1000))
      }
    }

    if (Date.now() > startTime) resolve()
    else tick()
  })

export const getInput = async (
  year = getCurrentYear(),
  day = getCurrentDay(),
  account?: string,
) => {
  validateDayAndYear(day, year)
  return makeRequest(`/${year}/day/${day}/input`, await getSessionToken(account))
}

export const printDescription = async (
  year = getCurrentYear(),
  day = getCurrentDay(),
  /** Part number to print or leave `undefined` to print all parts. */
  partNum?: number,
  account?: string,
) => {
  validateDayAndYear(day, year)
  const $ = cheerio.load(await makeRequest(`/${year}/day/${day}`, await getSessionToken(account)))
  const partEls = $('.day-desc')
  if (partNum) {
    const partEl = partEls[partNum - 1]
    if (!partEl) throw new Error(`cannot find part ${partNum} on page`)
    logHtml($(partEl).html())
  } else {
    partEls.each((i, el) => logHtml($(el).html()))
  }
}

export const submit = async (
  partNum: number,
  answer: string,
  day = getCurrentDay(),
  year = getCurrentYear(),
  logFeedback = true,
  account?: string,
) => {
  validateDayAndYear(day, year)
  const $ = cheerio.load(
    await makeRequest(`/${year}/day/${day}/answer`, await getSessionToken(account), {
      level: String(partNum),
      answer,
    }),
  )
  const main = $('main')

  // Remove useless links (since you cannot use them in the terminal)
  $(main)
    .find('a')
    .filter((i, el) => /^\s*\[.+\]\s*$/.test($(el).text()))
    .remove()
  const html = $(main)
    .html()
    .replace(/If\s+you[^]{1,8}re\s+stuck[^]+?subreddit[^]+?\.\s*/, '')
    .replace(/You\s+can[^]+?this\s+victory[^]+?\.\s*/, '')
  $(main).html(html)
  const text = $(main).text()

  if (logFeedback) logHtml(html)
  const isCorrect = text.includes("That's the right answer")
  return {
    isCorrect,
    isDone: isCorrect && partNum === 2,
    message: text.substr(0, text.indexOf('.')),
  }
}

export const runAndWatch = (
  commandBuilder: CommandBuilder,
  dir = process.cwd(),
  filesToWatch = [dir],
) => {
  let tempDir: undefined | string
  const commands = commandBuilder({
    get tempDir() {
      if (!tempDir) tempDir = tempy.directory({ prefix: 'aoc' })
      return tempDir
    },
  })

  let killPrevRun: undefined | (() => void)
  return chokidar.watch(filesToWatch.map(file => path.resolve(dir, file))).on('all', () => {
    if (killPrevRun) killPrevRun()

    let i = -1
    let killed = false
    const runNextCommand = (code?: number) => {
      if (killed) return

      if (code) {
        console.warn(chalk.yellow('Finished with error'))
        return
      }
      if (++i >= commands.length) {
        console.log(chalk.yellow('Finished'))
        return
      }

      const { command, args = [], cwd = dir } = commands[i]
      console.log(
        chalk.yellow(i === 0 ? 'Running command on file change:' : 'Running:'),
        [command, ...args].join(' '),
      )
      const cp = spawn(command, args, { cwd, stdio: 'inherit' })
      cp.on('close', runNextCommand)
      killPrevRun = () => {
        // TODO: How do I handle this gracefully?
        cp.kill()
        killed = true
      }
    }
    runNextCommand()
  })
}

interface PrivateLeaderboardJson {
  members: Record<
    string,
    { name: string; completion_day_level: Record<string, Record<string, { get_star_ts: string }>> }
  >
}

export const privateLeaderboardTimesToCsv = async (
  boardId: string,
  year = getCurrentYear(),
  account?: string,
) => {
  validateDayAndYear(1, year)
  const res: PrivateLeaderboardJson = JSON.parse(
    await makeRequest(
      `/${year}/leaderboard/private/view/${boardId}.json`,
      await getSessionToken(account),
    ),
  )

  const csv = [['Name']]
  for (let day = 1; day <= 25; day++) {
    for (const part of ['A', 'B']) {
      csv[0].push(`${padZero(day)} - ${part}`)
    }
  }
  for (const member of Object.values(res.members)) {
    const entry = [member.name, ...Array(25 * 2).fill('')]
    for (const [day, dayEntry] of Object.entries(member.completion_day_level)) {
      const challengeStart = Date.UTC(new Date().getUTCFullYear(), 11, +day, 5, 0, 0, 0)
      for (const [part, { get_star_ts }] of Object.entries(dayEntry)) {
        const submitTime = +get_star_ts * 1000
        const submitElapsed = Math.min(submitTime - challengeStart, 1000 * 60 * 60 * 24 - 1)
        const d = new Date(submitElapsed)
        entry[(+day - 1) * 2 + (+part - 1) + 1] = `${padZero(d.getUTCHours())}:${padZero(
          d.getUTCMinutes(),
        )}:${padZero(d.getUTCSeconds())}.${padZero(d.getUTCMilliseconds(), 3)}`
      }
    }
    csv.push(entry)
  }
  return csv
}
