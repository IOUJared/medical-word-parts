import { randomUUID } from "node:crypto";
import { closeSync, constants, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, rmdirSync } from "node:fs";
import { join } from "node:path";

import { anchoredDirectoryPath, assertNotSymbolicLink, durableWrite, isFileSystemError, JsonFileTransactionError } from "./json-file-transaction-fs";

const LOCK_NAME = ".candidate-apply-transaction.lock";
const CLAIMS_NAME = `${LOCK_NAME}-claims`;
const TICKET_PATTERN = /^(\d+)-(\d+|unknown)-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const LEGACY_LOCK_PATTERN = /^(\d+)\n$/u;

type Owner = {
  readonly pid: number;
  readonly startTime: string | null;
};

function processStartTime(pid: number): string | null {
  if (process.platform !== "linux") return null;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    const startTime = fields[19];
    return startTime !== undefined && /^\d+$/u.test(startTime) ? startTime : null;
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) return null;
    throw error;
  }
}

function ownerIsDefinitelyDead(owner: Owner): boolean {
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    if (isFileSystemError(error, "ESRCH")) return true;
    return false;
  }
  if (owner.startTime === null) return false;
  const currentStartTime = processStartTime(owner.pid);
  return currentStartTime !== null && currentStartTime !== owner.startTime;
}

function ownerFromTicket(ticketName: string): Owner | null {
  const match = TICKET_PATTERN.exec(ticketName);
  const pidText = match?.[1];
  const startTimeText = match?.[2];
  if (pidText === undefined || startTimeText === undefined) return null;
  const pid = Number(pidText);
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  return { pid, startTime: startTimeText === "unknown" ? null : startTimeText };
}

function sameFile(left: string, right: string): boolean {
  assertNotSymbolicLink(left);
  assertNotSymbolicLink(right);
  try {
    const leftStat = lstatSync(left);
    const rightStat = lstatSync(right);
    return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) return false;
    throw error;
  }
}

function removeDeadTickets(claimsPath: string, lockPath: string, ownTicketName: string): void {
  for (const ticketName of readdirSync(claimsPath)) {
    if (ticketName === ownTicketName) continue;
    const owner = ownerFromTicket(ticketName);
    if (owner === null || !ownerIsDefinitelyDead(owner)) {
      throw new JsonFileTransactionError("candidate apply transaction is already in progress");
    }
    const ticketPath = join(claimsPath, ticketName);
    if (sameFile(lockPath, ticketPath)) rmSync(lockPath, { force: true });
    rmSync(ticketPath, { force: true });
  }
}

function reclaimLegacyLock(lockPath: string): void {
  assertNotSymbolicLink(lockPath);
  let content: string;
  try {
    content = readFileSync(lockPath, "utf8");
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) return;
    throw error;
  }
  const pidText = LEGACY_LOCK_PATTERN.exec(content)?.[1];
  const pid = pidText === undefined ? Number.NaN : Number(pidText);
  if (!Number.isSafeInteger(pid) || pid <= 0 || !ownerIsDefinitelyDead({ pid, startTime: null })) {
    throw new JsonFileTransactionError("candidate apply transaction is already in progress");
  }
  rmSync(lockPath);
}

function removeClaimsDirectory(claimsPath: string): void {
  try {
    rmdirSync(claimsPath);
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT") && !isFileSystemError(error, "ENOTEMPTY")) throw error;
  }
}

export function withJsonFileTransactionLock<T>(dataDirectory: string, action: (anchoredRoot: string) => T): T {
  assertNotSymbolicLink(dataDirectory);
  const canonicalRoot = realpathSync(dataDirectory);
  const rootDescriptor = openSync(dataDirectory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  const anchoredRoot = anchoredDirectoryPath(rootDescriptor, canonicalRoot);
  if (realpathSync(anchoredRoot) !== canonicalRoot) {
    closeSync(rootDescriptor);
    throw new JsonFileTransactionError("transaction data directory changed during validation");
  }
  const claimsPath = join(anchoredRoot, CLAIMS_NAME);
  const lockPath = join(anchoredRoot, LOCK_NAME);
  mkdirSync(claimsPath, { mode: 0o700, recursive: true });
  assertNotSymbolicLink(claimsPath);
  const claimsDescriptor = openSync(claimsPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  const anchoredClaims = anchoredDirectoryPath(claimsDescriptor, realpathSync(claimsPath));
  const startTime = processStartTime(process.pid);
  const ticketName = `${process.pid}-${startTime ?? "unknown"}-${randomUUID()}`;
  const ticketPath = join(anchoredClaims, ticketName);
  let lockAcquired = false;
  try {
    durableWrite(ticketPath, "", true);
    removeDeadTickets(anchoredClaims, lockPath, ticketName);
    try {
      linkSync(ticketPath, lockPath);
    } catch (error) {
      if (!isFileSystemError(error, "EEXIST")) throw error;
      reclaimLegacyLock(lockPath);
      linkSync(ticketPath, lockPath);
    }
    lockAcquired = true;
    return action(anchoredRoot);
  } finally {
    if (lockAcquired && sameFile(lockPath, ticketPath)) rmSync(lockPath);
    rmSync(ticketPath, { force: true });
    closeSync(claimsDescriptor);
    removeClaimsDirectory(claimsPath);
    closeSync(rootDescriptor);
  }
}
