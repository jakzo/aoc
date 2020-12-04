#!/usr/bin/env node
import yargs from 'yargs'
import inquirer from 'inquirer'
import chalk from 'chalk'

import { countdownToStart, getInput, main, printDescription, submit } from './commands'

const readStdin = async () => {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').trim()
}

const cliHandler = <T>(fn: (args: T) => Promise<void>) => async (args: T) => {
  try {
    await fn(args)
  } catch (err) {
    console.error(chalk.red(String(err)))
    const isDebug = process.argv[1]?.endsWith('/bin.ts')
    console.log(isDebug, process.argv)
    if (isDebug) console.error(err)
    process.exit(1)
  }
}

yargs
  .scriptName('aoc')
  .epilog('Reads, runs and submits Advent of Code challenges')
  .command(
    '*',
    'Starts the full AoC dev loop for the next challenge from your terminal',
    yargs => yargs,
    cliHandler(async () => main()),
  )
  .command(
    'login <token>',
    'Prompts for a new session token',
    yargs =>
      yargs.positional('token', {
        type: 'string',
        description: 'Session token (use dev tools to find `session` cookie)',
      }),
    cliHandler(async () => main()),
  )
  .command(
    'countdown',
    'Counts down until the next challenge starts then exits',
    yargs =>
      yargs
        .option('margin', {
          alias: 'm',
          type: 'number',
          default: 23,
          description:
            'End immediately if the previous challenge started less than a certain number of hours ago',
        })
        .example([['$0 countdown', 'Counts down until the next challenge starts']]),
    cliHandler(async args => countdownToStart(args.margin * 1000 * 60 * 60)),
  )
  .command(
    'description',
    'Prints the description of a challenge',
    yargs =>
      yargs
        .option('year', {
          alias: 'y',
          type: 'number',
          description: 'The year of the challenge',
        })
        .option('day', {
          alias: 'd',
          type: 'number',
          description: 'The day of the challenge',
        })
        .option('part', {
          alias: 'p',
          type: 'number',
          description: 'The part number of the challenge (eg. 1 or 2)',
        })
        .example([
          [
            '$0 description',
            "Print both parts (if available) of the description to today's challenge",
          ],
          [
            '$0 description --year 2019 --day 3 --part 2',
            'Print the description of a specific challenge',
          ],
        ]),
    cliHandler(async args => printDescription(args.year, args.day, args.part)),
  )
  .command(
    'input',
    'Prints the input to a challenge',
    yargs =>
      yargs
        .option('year', {
          alias: 'y',
          type: 'number',
          description: 'The year of the challenge',
        })
        .option('day', {
          alias: 'd',
          type: 'number',
          description: 'The day of the challenge',
        })
        .example([
          ['$0 input', "Print the input to today's challenge"],
          ['$0 input --year 2019 --day 3', 'Print the input to a specific challenge'],
        ]),
    cliHandler(async args => {
      console.log(await getInput(args.year, args.day))
    }),
  )
  .command(
    'submit [answer]',
    'Submits an answer to a challenge',
    yargs =>
      yargs
        .option('year', {
          alias: 'y',
          type: 'number',
          description: 'The year of the challenge',
        })
        .option('day', {
          alias: 'd',
          type: 'number',
          description: 'The day of the challenge',
        })
        .option('part', {
          alias: 'p',
          type: 'number',
          description: 'The part number to submit (eg. 1 or 2)',
        })
        .positional('answer', {
          type: 'string',
          description: 'The answer to submit, if not provided it is read from input',
        })
        .demandOption('part')
        .example([
          ['$0 submit --part 1', "Prompt for answer to today's challenge from input"],
          ['echo "my answer" | $0 submit --part 1', 'Provide answer as input'],
          ['$0 submit --part 1 "my answer"', 'Provide answer as an argument'],
          ['$0 submit --year 2019 --day 3 --part 2', 'Give an answer to a specific challenge'],
        ]),
    cliHandler(async args => {
      const answer =
        args.answer ||
        (await readStdin()) ||
        (
          await inquirer.prompt<{ answer: string }>([
            { name: 'answer', message: 'Enter your answer:' },
          ])
        ).answer
      await submit(args.part, answer.trim(), args.day, args.year)
    }),
  )
  .alias('h', 'help')
  .alias('v', 'version')
  .parse()
