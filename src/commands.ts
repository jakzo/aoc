import cliHtml from 'cli-html'
import cheerio from 'cheerio'
import { formatDistanceToNowStrict } from 'date-fns'
import keytar from 'keytar'

import {
  getCurrentDay,
  getCurrentYear,
  validateDayAndYear,
  makeRequest,
  getSessionToken,
  getNextChallengeStart,
  getPrevChallengeStart,
  DEFAULT_ACCOUNT,
  KEYTAR_SERVICE_NAME,
} from './utils'

export const main = async (account?: string) => {
  await getSessionToken(account, true)
  await countdownToStart()
  await printDescription(undefined, undefined, undefined, account)
}

export const loginPrompt = async (account = DEFAULT_ACCOUNT) => {
  await keytar.deletePassword(KEYTAR_SERVICE_NAME, account)
  await getSessionToken(account, true)
}

export const countdownToStart = async (
  margin = 1000 * 60 * 60 * 23,
  startTime = getNextChallengeStart().getTime(),
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

    if (Date.now() - getPrevChallengeStart().getTime() < margin) resolve()
    else tick()
  })

export const getInput = async (
  day = getCurrentDay(),
  year = getCurrentYear(),
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
    console.log(cliHtml($(partEl).html()))
  } else {
    partEls.each((i, el) => console.log(cliHtml($(el).html())))
  }
}

export const submit = async (
  partNum: number,
  answer: string,
  day = getCurrentDay(),
  year = getCurrentYear(),
  account?: string,
) => {
  validateDayAndYear(day, year)
  const formData = new FormData()
  formData.append('level', String(partNum))
  formData.append('answer', answer)
  await makeRequest(`/${year}/day/${day}/answer`, await getSessionToken(account), formData)
}
