import { spawn } from "child_process";
import path from "path";

import chalk from "chalk";
import cheerio from "cheerio";
import * as chokidar from "chokidar";
import { formatDistanceToNowStrict } from "date-fns";
import * as fse from "fs-extra";
import inquirer from "inquirer";
import * as keytar from "keytar";
import tempy from "tempy";

import { CommandBuilder } from "./templates";
import {
  DEFAULT_ACCOUNT,
  KEYTAR_SERVICE_NAME,
  getChallengeStartTime,
  getCurrentChallengeStartTime,
  getCurrentDay,
  getCurrentYear,
  getDirForDay,
  getLocalTemplateFiles,
  getSessionToken,
  logHtml,
  makeRequest,
  normalizeTemplate,
  padZero,
  validateDayAndYear,
} from "./utils";

export const main = async (
  year = getCurrentChallengeStartTime().getUTCFullYear(),
  day = getCurrentChallengeStartTime().getUTCDate(),
  account?: string
): Promise<void> => {
  await getSessionToken(account, true);
  await countdownToStart(undefined, getChallengeStartTime(year, day).getTime());
  // TODO: Continue to part 2 if part 1 is already completed
  let part = 1;
  const desc = await printDescription(year, day, part, account);
  const dir = getDirForDay(day);
  await fse.ensureDir(dir);
  const inputFile = path.join(dir, "input.txt");
  if (!(await fse.pathExists(inputFile)))
    await fse.writeFile(inputFile, await getInput(year, day));
  const inputSampleFile = path.join(dir, "input-sample.txt");
  if (!(await fse.pathExists(inputSampleFile))) {
    const sampleInput = readSampleInput(...desc);
    if (sampleInput) await fse.writeFile(inputSampleFile, sampleInput);
  }
  while (true) {
    while (true) {
      console.log("");
      const { answer } = await inquirer.prompt<{ answer: string }>([
        { name: "answer", message: "Enter your answer:" },
      ]);
      const { isCorrect, isDone } = await submit(
        part,
        answer,
        year,
        day,
        true,
        account
      );
      if (isCorrect) {
        const wipRegex = /\bwip\b/i;
        for (const filename of await fse.readdir(dir)) {
          if (!wipRegex.test(filename)) continue;
          await fse.copy(
            path.join(dir, filename),
            path.join(dir, filename.replace(wipRegex, `part${part}`))
          );
        }
        if (isDone) return;
        part++;
        break;
      }
    }
    await printDescription(year, day, part, account);
  }
};

export const start = async (
  templateNameOrPath = "js",
  year = getCurrentYear(),
  day = getCurrentDay(year)
): Promise<chokidar.FSWatcher> => {
  const dir = getDirForDay(day);
  const normalizedTemplate = await normalizeTemplate(templateNameOrPath);
  await copyTemplates(dir, normalizedTemplate.path);
  return runAndWatch(
    normalizedTemplate.commandBuilder,
    dir,
    normalizedTemplate.files
  );
};

export const loginPrompt = async (account = DEFAULT_ACCOUNT): Promise<void> => {
  await keytar.deletePassword(KEYTAR_SERVICE_NAME, account);
  await getSessionToken(account, true);
};

export const copyTemplates = async (
  outputPath: string,
  templatePath: string
): Promise<void> => {
  for (const name of await getLocalTemplateFiles(templatePath)) {
    await fse.copy(path.join(templatePath, name), path.join(outputPath, name), {
      overwrite: false,
    });
  }
};

// TODO: Synchronize with AoC time
export const countdownToStart = async (
  margin = 1000 * 60 * 60 * 23,
  startTime = getCurrentChallengeStartTime(margin).getTime()
): Promise<void> =>
  new Promise<void>((resolve) => {
    const tick = (): void => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      const now = Date.now();
      if (now >= startTime) {
        console.log("Challenge starting now!");
        resolve();
      } else {
        process.stdout.write(
          `Challenge starts in ${formatDistanceToNowStrict(startTime + 500)}`
        );
        // Align the ticks to the startTime
        setTimeout(
          tick,
          1000 - (((now % 1000) - (startTime % 1000) + 1000) % 1000)
        );
      }
    };

    if (Date.now() > startTime) resolve();
    else tick();
  });

export const getInput = async (
  year = getCurrentYear(),
  day = getCurrentDay(year),
  account?: string
): Promise<string> => {
  validateDayAndYear(day, year);
  return makeRequest(
    `/${year}/day/${day}/input`,
    await getSessionToken(account)
  );
};

export const getSampleInput = async (
  year = getCurrentYear(),
  day = getCurrentDay(year),
  account?: string
): Promise<string | undefined> =>
  readSampleInput(...(await fetchDescriptionParts(year, day, account)));

const readSampleInput = (
  $: cheerio.Root,
  partEls: cheerio.Cheerio
): string | undefined => {
  const sampleInput = $(partEls[0]).find("pre").first();
  if (!sampleInput) return undefined;
  return $(sampleInput).text();
};

export const printDescription = async (
  year = getCurrentYear(),
  day = getCurrentDay(year),
  /** Part number to print or leave `undefined` to print all parts. */
  partNum?: number,
  account?: string
): Promise<[cheerio.Root, cheerio.Cheerio]> => {
  const [$, partEls] = await fetchDescriptionParts(year, day, account);
  if (partNum) {
    const partEl = partEls[partNum - 1];
    if (!partEl) throw new Error(`cannot find part ${partNum} on page`);
    logHtml($(partEl).html()!);
  } else {
    partEls.each((i, el) => logHtml($(el).html()!));
  }
  return [$, partEls];
};

const fetchDescriptionParts = async (
  year = getCurrentYear(),
  day = getCurrentDay(year),
  account?: string
): Promise<[cheerio.Root, cheerio.Cheerio]> => {
  validateDayAndYear(day, year);
  const $ = cheerio.load(
    await makeRequest(`/${year}/day/${day}`, await getSessionToken(account))
  );
  return [$, $(".day-desc")];
};

export const submit = async (
  partNum: number,
  answer: string,
  year = getCurrentYear(),
  day = getCurrentDay(year),
  logFeedback = true,
  account?: string
): Promise<{ isCorrect: boolean; isDone: boolean; message: string }> => {
  validateDayAndYear(day, year);
  const $ = cheerio.load(
    await makeRequest(
      `/${year}/day/${day}/answer`,
      await getSessionToken(account),
      {
        level: String(partNum),
        answer,
      }
    )
  );
  const main = $("main");

  // Remove useless links (since you cannot use them in the terminal)
  $(main)
    .find("a")
    .filter((i, el) => /^\s*\[.+\]\s*$/.test($(el).text()))
    .remove();
  const html = $(main)
    .html()!
    .replace(/If\s+you[^]{1,8}re\s+stuck[^]+?subreddit[^]+?\.\s*/, "")
    .replace(/You\s+can[^]+?this\s+victory[^]+?\.\s*/, "");
  $(main).html(html);
  const text = $(main).text();

  if (logFeedback) logHtml(html);
  const isCorrect = text.includes("That's the right answer");
  return {
    isCorrect,
    isDone: isCorrect && partNum === 2,
    message: text.substr(0, text.indexOf(".")),
  };
};

export const runAndWatch = (
  commandBuilder: CommandBuilder,
  dir = process.cwd(),
  filesToWatch = [dir]
): chokidar.FSWatcher => {
  let tempDir: undefined | string;
  const commands = commandBuilder({
    get tempDir() {
      if (!tempDir) tempDir = tempy.directory({ prefix: "aoc" });
      return tempDir;
    },
  });

  let killPrevRun: undefined | (() => void);
  return chokidar
    .watch(filesToWatch.map((file) => path.resolve(dir, file)))
    .on("all", () => {
      if (killPrevRun) killPrevRun();

      let i = -1;
      let killed = false;
      const runNextCommand = (code?: number): void => {
        if (killed) return;

        if (code) {
          console.warn(chalk.yellow("Finished with error"));
          return;
        }
        if (++i >= commands.length) {
          console.log(chalk.yellow("Finished"));
          return;
        }

        const { command, args = [], cwd = dir } = commands[i];
        console.log(
          chalk.yellow(
            i === 0 ? "Running command on file change:" : "Running:"
          ),
          [command, ...args].join(" ")
        );
        const cp = spawn(command, args, { cwd, stdio: "inherit" });
        cp.on("close", runNextCommand);
        killPrevRun = () => {
          // TODO: How do I handle this gracefully?
          cp.kill();
          killed = true;
        };
      };
      runNextCommand();
    });
};

interface PrivateLeaderboardJson {
  members: Record<
    string,
    {
      name: string;
      completion_day_level: Record<
        string,
        Record<string, { get_star_ts: string }>
      >;
    }
  >;
}

export const privateLeaderboardTimesToCsv = async (
  boardId: string,
  year = getCurrentYear(),
  account?: string
): Promise<string[][]> => {
  validateDayAndYear(1, year);
  const res = JSON.parse(
    await makeRequest(
      `/${year}/leaderboard/private/view/${boardId}.json`,
      await getSessionToken(account)
    )
  ) as PrivateLeaderboardJson;

  const csv = [["Name"]];
  for (let day = 1; day <= 25; day++) {
    for (const part of ["A", "B"]) {
      csv[0].push(`${padZero(day)} - ${part}`);
    }
  }
  for (const member of Object.values(res.members)) {
    const entry = [member.name, ...(Array(25 * 2).fill("") as string[])];
    for (const [day, dayEntry] of Object.entries(member.completion_day_level)) {
      const challengeStart = Date.UTC(
        new Date().getUTCFullYear(),
        11,
        +day,
        5,
        0,
        0,
        0
      );
      for (const [part, { get_star_ts }] of Object.entries(dayEntry)) {
        const submitTime = +get_star_ts * 1000;
        const submitElapsed = Math.min(
          submitTime - challengeStart,
          1000 * 60 * 60 * 24 - 1
        );
        const d = new Date(submitElapsed);
        entry[(+day - 1) * 2 + (+part - 1) + 1] = `${padZero(
          d.getUTCHours()
        )}:${padZero(d.getUTCMinutes())}:${padZero(
          d.getUTCSeconds()
        )}.${padZero(d.getUTCMilliseconds(), 3)}`;
      }
    }
    csv.push(entry);
  }
  return csv;
};
