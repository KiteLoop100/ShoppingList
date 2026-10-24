import path from "node:path";

/** Storage state (cookies + localStorage) of the run's single anonymous test session. */
export const AUTH_DIR = path.resolve(__dirname, "..", ".auth");
export const AUTH_FILE = path.join(AUTH_DIR, "user.json");
