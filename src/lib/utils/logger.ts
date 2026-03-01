const isDev = process.env.NODE_ENV !== "production";

function info(prefix: string, ...args: unknown[]): void {
  console.info(prefix, ...args);
}

function warn(prefix: string, ...args: unknown[]): void {
  console.warn(prefix, ...args);
}

function error(prefix: string, ...args: unknown[]): void {
  console.error(prefix, ...args);
}

function debug(prefix: string, ...args: unknown[]): void {
  if (isDev) {
    console.log(prefix, ...args);
  }
}

export const log = { info, warn, error, debug };
