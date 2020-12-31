/* eslint-disable */
// This file is unused right now but if I ever want to integrate the test runner with solution
// submission I'll use this to automatically print the next part of the description
import net, { Socket } from "net";
import os from "os";

export type TerminalId = "description" | "runner";

const callbackToAsyncIterator = <T>() => {
  // The last item in the promiseQueue should always be an unresolved promise
  const promiseQueue: Promise<IteratorResult<T>>[] = [];
  let resolveLatest: (value: T) => void;

  const addPromiseToQueue = () => {
    let resolve: (value: IteratorResult<T>) => void;
    promiseQueue.push(new Promise<IteratorResult<T>>((r) => (resolve = r)));
    resolveLatest = (value) => resolve({ done: false, value });
  };
  addPromiseToQueue();

  const iterator: AsyncIterator<T> = {
    next: () => promiseQueue.shift(),
  };
  const iterable: AsyncIterable<T> = {
    [Symbol.asyncIterator]: () => iterator,
  };
  return {
    callback: (value: T) => {
      resolveLatest(value);
      addPromiseToQueue();
    },
    iterator,
    iterable,
  };
};

const getPipeName = (id: TerminalId) =>
  os.platform() === "win32" ? `\\\\.\\pipe\\aoc-${id}` : `/tmp/aoc-${id}.sock`;

const isTerminalRunning = async (id: TerminalId) =>
  new Promise((resolve, reject) => {
    const client = net.createConnection(getPipeName(id), () => {});
    client.on("error", (err) => {
      if (err && (err as any).code === "ENOENT") {
        resolve(false);
      } else {
        reject(err);
      }
    });
    client.on("connect", () => {
      resolve(true);
      client.end();
    });
  });

const createIpcServer = async (
  id: TerminalId,
  onConnection: (socket: Socket) => void
) =>
  new Promise((resolve, reject) => {
    const server = net.createServer().listen(getPipeName(id));
    server.on("error", reject);
    server.on("connection", onConnection);
    server.on("listening", resolve);
  });

export const startIpcServer = async () => {
  if (!(await isTerminalRunning("description"))) {
    const {
      callback,
      iterable: answersToSubmit,
    } = callbackToAsyncIterator<string>();
    await createIpcServer("description", (socket) => {
      socket.on("data", (data) => {
        callback(data.toString());
      });
    });
    return {
      id: "description",
      answersToSubmit,
    };
  }

  if (!(await isTerminalRunning("runner"))) {
    await createIpcServer("runner", (socket) => {
      socket.end();
    });
    return { id: "runner" };
  }

  throw new Error("Description and runner terminals are both already running");
};
