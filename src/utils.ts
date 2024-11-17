import path from "path";

import axios from "axios";
import chalk from "chalk";
import cliHtml from "cli-html";
import * as fse from "fs-extra";
import inquirer from "inquirer";
import * as keytar from "keytar";
import stringArgv from "string-argv";

import {
  AocTemplate,
  AocTemplateBuiltin,
  AocTemplateNormalized,
  builtinTemplates,
} from "./templates";

export const KEYTAR_SERVICE_NAME = "jakzo-aoc";
export const DEFAULT_ACCOUNT = "_default";
export const TEMPLATE_JSON = "aoc.json";
const BASE_URL = "https://adventofcode.com";
const BACKOFF_RATE = 1.2;
const BACKOFF_INITIAL = 1000;
const BACKOFF_MAX = 30000;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PACKAGE_JSON = require("../package.json") as {
  name: string;
  version: string;
  homepage: string;
};

export const logHtml = (html: string): void => {
  console.log(cliHtml(html).replace(/\n+$/, ""));
};

export const getCurrentDay = (year: number): number => {
  const now = new Date();
  if (year === now.getUTCFullYear()) {
    if (now.getUTCMonth() !== 11)
      throw new Error("Advent of Code has not started yet");
    const day = now.getUTCDate();
    if (day > 25) throw new Error("Advent of Code is over");
    return day;
  } else {
    console.warn(chalk.yellow("No day given. Defaulting to day 1..."));
    return 1;
  }
};

export const getCurrentYear = (): number => new Date().getUTCFullYear();

const isTokenValid = async (token: string): Promise<boolean> => {
  const res = await axios({
    url: BASE_URL,
    headers: { cookie: `session=${token}` },
    validateStatus: () => true,
  });
  return res.status < 300;
};

export const promptForToken = async (verifyToken = false): Promise<string> => {
  let input = await inquirer.prompt<{ token: string }>([
    {
      name: "token",
      message: "Enter your session token:",
      suffix: " (use browser dev tools and find the `session` cookie)",
      transformer: (token: string) => token.trim(),
      validate: (token?: string) => (token ? true : "Token is required"),
    },
  ]);
  while (verifyToken && !(await isTokenValid(input.token))) {
    input = await inquirer.prompt<{ token: string }>([
      {
        name: "token",
        message: "Token invalid. Please try again:",
        transformer: (token: string) => token.trim(),
        validate: (token?: string) => (token ? true : "Token is required"),
      },
    ]);
  }
  return input.token;
};

export const getSessionToken = async (
  account = DEFAULT_ACCOUNT,
  verifyToken = false
): Promise<string> => {
  const token = await keytar.getPassword(KEYTAR_SERVICE_NAME, account);
  if (token) {
    if (verifyToken && !(await isTokenValid(token)))
      throw new Error("token is not valid");
    return token;
  }

  return getNewSessionToken(account, verifyToken);
};

export const getNewSessionToken = async (
  account = DEFAULT_ACCOUNT,
  verifyToken = false
): Promise<string> => {
  const inputToken = await promptForToken(verifyToken);
  await keytar.setPassword(KEYTAR_SERVICE_NAME, account, inputToken);
  return inputToken;
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const padZero = (n: number, length = 2): string =>
  `${n}`.padStart(length, "0");

export const formUrlEncoded = (data: Record<string, string>): string =>
  Object.entries(data)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

/** Makes a request and retries quickly on 5XX. After some time of failure it will wait longer to retry. */
export const makeRequest = async (
  url: string,
  token: string,
  data?: Record<string, string>
): Promise<string> => {
  let timeOfLastRequest = 0;
  let currentWait = BACKOFF_INITIAL;
  while (true) {
    const now = Date.now();
    const timeOfNextRequest = timeOfLastRequest + currentWait;
    if (timeOfNextRequest > now) await sleep(timeOfNextRequest - now);
    currentWait = Math.min(currentWait * BACKOFF_RATE, BACKOFF_MAX);
    timeOfLastRequest = now;

    let res: { status: number; data: Buffer };
    try {
      res = await axios({
        url: `${BASE_URL}${url}`,
        method: data ? "POST" : "GET",
        headers: {
          "User-Agent": `Mozilla/5.0 (compatible; ${PACKAGE_JSON.name}:${
            PACKAGE_JSON.version
          }; +${PACKAGE_JSON.homepage.replace(/#.+/, "")})`,
          ...(data
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : undefined),
          ...(token ? { cookie: `session=${token}` } : undefined),
        },
        responseType: "arraybuffer",
        timeout: Math.max(5000, currentWait),
        data: data ? formUrlEncoded(data) : undefined,
      });
    } catch (err) {
      const response = (err as {
        response?: {
          status: number;
          statusText: string;
          headers: { "set-cookie"?: string[] };
        };
      })?.response;
      if (
        response &&
        response.status &&
        response.status >= 300 &&
        response.status < 500
      ) {
        if (
          response.status === 401 ||
          (response.status === 400 &&
            token &&
            response.headers["set-cookie"]?.some((value) =>
              value.startsWith("session=;")
            ))
        ) {
          // TODO: Use appropriate account
          token = await getNewSessionToken();
          continue;
        }
        throw new Error(`Request failed: ${err}`);
      }
      console.warn(`Request failed and will retry: ${err}`);
      continue;
    }

    const responseText = res.data.toString();
    if (res.status >= 300) throw new Error(responseText);
    return responseText;
  }
};

export const validateDayAndYear = (day: number, year: number): void => {
  if (day < 1 || day > 25) throw new Error("day must be between 1 and 25");
  if (year < 2015) throw new Error("year must be 2015 or greater");
  if (year > new Date().getUTCFullYear())
    throw new Error("year must not be in the future");
};

const getNextChallengeStart = (): Date => {
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const firstChallengeOfYear = new Date(Date.UTC(curYear, 11, 1, 5, 0, 0, 0));
  const lastChallengeOfYear = new Date(Date.UTC(curYear, 11, 25, 5, 0, 0, 0));
  const firstChallengeOfNextYear = new Date(
    Date.UTC(curYear + 1, 11, 1, 5, 0, 0, 0)
  );
  if (now < firstChallengeOfYear) return firstChallengeOfYear;
  if (now > lastChallengeOfYear) return firstChallengeOfNextYear;
  return new Date(
    Date.UTC(
      curYear,
      11,
      now.getUTCDate() + (now.getUTCHours() >= 5 ? 1 : 0),
      5,
      0,
      0,
      0
    )
  );
};

const getPrevChallengeStart = (): Date => {
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const firstChallengeOfYear = new Date(Date.UTC(curYear, 11, 1, 5, 0, 0, 0));
  const lastChallengeOfYear = new Date(Date.UTC(curYear, 11, 25, 5, 0, 0, 0));
  const lastChallengeOfLastYear = new Date(
    Date.UTC(curYear - 1, 11, 25, 5, 0, 0, 0)
  );
  if (now < firstChallengeOfYear) return lastChallengeOfLastYear;
  if (now > lastChallengeOfYear) return lastChallengeOfYear;
  return new Date(
    Date.UTC(
      curYear,
      11,
      now.getUTCDate() - (now.getUTCHours() < 5 ? 1 : 0),
      5,
      0,
      0,
      0
    )
  );
};

export const getCurrentChallengeStartTime = (
  margin = 1000 * 60 * 60 * 23
): Date => {
  const next = getNextChallengeStart();
  const prev = getPrevChallengeStart();
  return Date.now() - prev.getTime() < margin ? prev : next;
};

export const getChallengeStartTime = (year: number, day: number): Date =>
  new Date(Date.UTC(year, 11, day, 5, 0, 0, 0));

export const normalizeTemplate = async (
  template: AocTemplate | string
): Promise<AocTemplateNormalized> => {
  if (typeof template === "string") {
    if (Object.prototype.hasOwnProperty.call(builtinTemplates, template))
      return builtinTemplates[template as AocTemplateBuiltin];
    const localTemplatePath = path.resolve(template);
    const localJsonPath = path.join(localTemplatePath, TEMPLATE_JSON);
    const localJson = (await fse.readJson(localJsonPath).catch((err) => {
      if ((err as { code?: string })?.code !== "ENOENT") throw err;
    })) as { commands: string[] } | undefined;
    if (localJson !== undefined) {
      if (!Array.isArray(localJson?.commands))
        throw new Error(`Template has no commands at '${localJsonPath}'`);
      return {
        path: localTemplatePath,
        commandBuilder: ({ tempDir }) =>
          localJson.commands.map((cmd) => {
            const [command, ...args] = stringArgv(
              cmd.replace(/\{\{TEMP_DIR\}\}/g, tempDir)
            );
            return { command, args };
          }),
        files: await getLocalTemplateFiles(localTemplatePath),
      };
    }
    throw new Error(
      `built-in template '${template}' does not exist, nor does '${localJsonPath}'`
    );
  }

  return template;
};

export const getLocalTemplateFiles = async (
  templateDir: string
): Promise<string[]> => {
  const allFiles = await fse.readdir(templateDir);
  return allFiles.filter((name) => name !== TEMPLATE_JSON);
};

export const buildCommand = (command: string, srcPath: string): string => {
  const vars: Record<string, string> = {
    src: path.relative(process.cwd(), srcPath),
  };
  return command.replace(/\{([^}]+)\}/g, (_match, _i, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key))
      throw new Error(`unknown variable '${key}' in template command`);
    return vars[key];
  });
};

export const getDirForDay = (day: number): string =>
  path.resolve(padZero(day, 2));
