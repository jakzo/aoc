#!/usr/bin/env node
import chalk from "chalk";
import inquirer from "inquirer";
import yargs from "yargs";

import {
  copyTemplates,
  countdownToStart,
  getInput,
  loginPrompt,
  main,
  printDescription,
  privateLeaderboardTimesToCsv,
  start,
  submit,
} from "./commands";
import { normalizeTemplate } from "./utils";

const readStdin = async (): Promise<string> => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
};

const cliHandler = <T>(fn: (args: T) => Promise<void>) => (args: T) => {
  fn(args).catch((err) => {
    console.error(chalk.red(String(err)));
    const isDebug = process.argv[1]?.endsWith("/bin.ts");
    if (isDebug) console.error(err);
    process.exit(1);
  });
};

yargs
  .scriptName("aoc")
  .epilog("Reads, runs and submits Advent of Code challenges")
  .command(
    "*",
    "Counts down, saves input, prints description and prompts for answers to the upcoming challenge",
    (yargs) =>
      yargs
        .option("year", {
          alias: "y",
          type: "number",
          description: "The year of the challenge",
        })
        .option("day", {
          alias: "d",
          type: "number",
          description: "The day of the challenge",
        }),
    cliHandler(async (args) => main(args.year, args.day))
  )
  .command(
    "start [language]",
    "Creates and run files from a template for a language (does not overwrite)",
    (yargs) =>
      yargs
        .positional("language", {
          type: "string",
          description:
            "Name of built-in language template or path to local template folder",
        })
        .option("day", {
          alias: "d",
          type: "number",
          description: "The day of the challenge",
        }),
    cliHandler(async (args) => {
      await start(args.language, args.year, args.day);
    })
  )
  .command(
    "login",
    "Prompts for a new session token",
    (yargs) => yargs,
    cliHandler(async () => loginPrompt())
  )
  .command(
    "template <output>",
    "Copies a template folder (does not overwrite)",
    (yargs) =>
      yargs
        .positional("output", {
          type: "string",
          demandOption: true,
          description:
            "Path to the directory to create and fill with the template contents",
        })
        .option("template", {
          alias: "t",
          type: "string",
          description: "Path to the template directory",
        })
        .option("language", {
          alias: "l",
          type: "string",
          description: "Name of built-in language template",
        }),
    cliHandler(async (args) => {
      if (!args.template && !args.language)
        throw new Error(
          "Either the 'template' or 'language' option must be set"
        );
      await copyTemplates(
        args.output,
        args.template
          ? args.template
          : (await normalizeTemplate(args.language!)).path
      );
    })
  )
  .command(
    "countdown",
    "Counts down until the next challenge starts then exits",
    (yargs) =>
      yargs
        .option("margin", {
          alias: "m",
          type: "number",
          default: 23,
          description:
            "End immediately if the previous challenge started less than a certain number of hours ago",
        })
        .example([
          ["$0 countdown", "Counts down until the next challenge starts"],
        ]),
    cliHandler(async (args) => countdownToStart(args.margin * 1000 * 60 * 60))
  )
  .command(
    "description",
    "Prints the description of a challenge",
    (yargs) =>
      yargs
        .option("year", {
          alias: "y",
          type: "number",
          description: "The year of the challenge",
        })
        .option("day", {
          alias: "d",
          type: "number",
          description: "The day of the challenge",
        })
        .option("part", {
          alias: "p",
          type: "number",
          description: "The part number of the challenge (eg. 1 or 2)",
        })
        .example([
          [
            "$0 description",
            "Print both parts (if available) of the description to today's challenge",
          ],
          [
            "$0 description --year 2019 --day 3 --part 2",
            "Print the description of a specific challenge",
          ],
        ]),
    cliHandler(async (args) => {
      await printDescription(args.year, args.day, args.part);
    })
  )
  .command(
    "input",
    "Prints the input to a challenge",
    (yargs) =>
      yargs
        .option("year", {
          alias: "y",
          type: "number",
          description: "The year of the challenge",
        })
        .option("day", {
          alias: "d",
          type: "number",
          description: "The day of the challenge",
        })
        .example([
          ["$0 input", "Print the input to today's challenge"],
          [
            "$0 input --year 2019 --day 3",
            "Print the input to a specific challenge",
          ],
        ]),
    cliHandler(async (args) => {
      console.log(await getInput(args.year, args.day));
    })
  )
  .command(
    "submit [answer]",
    "Submits an answer to a challenge",
    (yargs) =>
      yargs
        .option("year", {
          alias: "y",
          type: "number",
          description: "The year of the challenge",
        })
        .option("day", {
          alias: "d",
          type: "number",
          description: "The day of the challenge",
        })
        .option("part", {
          alias: "p",
          type: "number",
          description: "The part number to submit (eg. 1 or 2)",
        })
        .positional("answer", {
          type: "string",
          description:
            "The answer to submit, if not provided it is read from input",
        })
        .demandOption("part")
        .example([
          [
            "$0 submit --part 1",
            "Prompt for answer to today's challenge from input",
          ],
          ['echo "my answer" | $0 submit --part 1', "Provide answer as input"],
          ['$0 submit --part 1 "my answer"', "Provide answer as an argument"],
          [
            "$0 submit --year 2019 --day 3 --part 2",
            "Give an answer to a specific challenge",
          ],
        ]),
    cliHandler(async (args) => {
      const answer =
        args.answer ||
        (await readStdin()) ||
        (
          await inquirer.prompt<{ answer: string }>([
            { name: "answer", message: "Enter your answer:" },
          ])
        ).answer;
      await submit(args.part, answer.trim(), args.year, args.day);
    })
  )
  .command(
    "leaderboard <id>",
    "Outputs a CSV of times to completion for a private leaderboard",
    (yargs) =>
      yargs
        .option("year", {
          alias: "y",
          type: "number",
          description: "The year of the times to output",
        })
        .positional("id", {
          type: "string",
          demandOption: true,
          description: "Private leaderboard ID (find it in the URL)",
        }),
    cliHandler(async (args) => {
      const csv = await privateLeaderboardTimesToCsv(args.id, args.year);
      for (const line of csv) {
        console.log(line.join(","));
      }
    })
  )
  .alias("h", "help")
  .alias("v", "version")
  .parse();
