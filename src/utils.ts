import keytar from 'keytar'
import inquirer from 'inquirer'
import axios from 'axios'

export const KEYTAR_SERVICE_NAME = 'advent-of-code'
export const DEFAULT_ACCOUNT = '_default'
const BASE_URL = 'https://adventofcode.com'
const BACKOFF_RATE = 1.1
const BACKOFF_INITIAL = 1000
const BACKOFF_MAX = 30000

export const getCurrentDay = () => {
  const now = new Date()
  if (now.getUTCMonth() !== 11) throw new Error('Advent of Code has not started yet')
  const day = now.getUTCDate()
  if (day > 25) throw new Error('Advent of Code is over')
  return day
}

export const getCurrentYear = () => new Date().getUTCFullYear()

const isTokenValid = async (token: string) => {
  const res = await axios({
    url: BASE_URL,
    headers: { cookie: `session=${token}` },
    validateStatus: () => true,
  })
  return res.status < 300
}

export const promptForToken = async (verifyToken = false) => {
  let input = await inquirer.prompt<{ token: string }>([
    {
      name: 'token',
      message: 'Enter your session token:',
      suffix: ' (use browser dev tools and find the `session` cookie)',
      transformer: token => token.trim(),
      validate: token => (token ? true : 'Token is required'),
    },
  ])
  while (verifyToken && !(await isTokenValid(input.token))) {
    input = await inquirer.prompt<{ token: string }>([
      {
        name: 'token',
        message: 'Token invalid. Please try again:',
        transformer: token => token.trim(),
        validate: token => (token ? true : 'Token is required'),
      },
    ])
  }
  return input.token
}

export const getSessionToken = async (account = DEFAULT_ACCOUNT, verifyToken = false) => {
  const token = await keytar.getPassword(KEYTAR_SERVICE_NAME, account)
  if (token) {
    if (verifyToken && !(await isTokenValid(token))) throw new Error('token is not valid')
    return token
  }

  const inputToken = await promptForToken(verifyToken)
  await keytar.setPassword(KEYTAR_SERVICE_NAME, account, inputToken)
  return inputToken
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Makes a request and retries quickly on 5XX. After some time of failure it will wait longer to retry. */
export const makeRequest = async (url: string, token: string, formData?: FormData) => {
  const startTime = Date.now()
  let timeOfLastRequest = 0
  let currentWait = BACKOFF_INITIAL
  while (true) {
    const timeSinceLastRequest = Date.now() - timeOfLastRequest
    if (timeSinceLastRequest < currentWait) await sleep(currentWait - timeSinceLastRequest)
    currentWait = Math.min(currentWait * BACKOFF_RATE, BACKOFF_MAX)

    const res = await axios({
      url: `${BASE_URL}${url}`,
      method: formData ? 'POST' : 'GET',
      headers: {
        ...(formData ? { 'Content-Type': 'multipart/form-data' } : undefined),
        ...(token ? { cookie: `session=${token}` } : undefined),
      },
      timeout: 15000,
      data: formData,
    })
    if (res.status >= 500) {
      console.warn(`Request failed with code ${res.status}. Retrying...`)
      continue
    }
    // TODO: Prompt for session token if it's an auth error
    if (res.status >= 300) throw new Error(res.data)
    return res.data
  }
}

export const validateDayAndYear = (day: number, year: number) => {
  if (day < 1 || day > 25) throw new Error('day must be between 1 and 25')
  if (year < 2015) throw new Error('year must be 2015 or greater')
}

export const getNextChallengeStart = () => {
  const now = new Date()
  const curYear = now.getUTCFullYear()
  const firstChallengeOfYear = new Date(Date.UTC(curYear, 11, 1, 5, 0, 0, 0))
  const lastChallengeOfYear = new Date(Date.UTC(curYear, 11, 25, 5, 0, 0, 0))
  const firstChallengeOfNextYear = new Date(Date.UTC(curYear + 1, 11, 1, 5, 0, 0, 0))
  if (now < firstChallengeOfYear) return firstChallengeOfYear
  if (now > lastChallengeOfYear) return firstChallengeOfNextYear
  return new Date(
    Date.UTC(curYear, 11, now.getUTCDate() + (now.getUTCHours() >= 5 ? 1 : 0), 5, 0, 0, 0),
  )
}

export const getPrevChallengeStart = () => {
  const now = new Date()
  const curYear = now.getUTCFullYear()
  const firstChallengeOfYear = new Date(Date.UTC(curYear, 11, 1, 5, 0, 0, 0))
  const lastChallengeOfYear = new Date(Date.UTC(curYear, 11, 25, 5, 0, 0, 0))
  const lastChallengeOfLastYear = new Date(Date.UTC(curYear + 1, 11, 1, 5, 0, 0, 0))
  if (now < firstChallengeOfYear) return lastChallengeOfLastYear
  if (now > lastChallengeOfYear) return lastChallengeOfYear
  return new Date(
    Date.UTC(curYear, 11, now.getUTCDate() - (now.getUTCHours() < 5 ? 1 : 0), 5, 0, 0, 0),
  )
}
