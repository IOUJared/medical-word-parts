import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, existsSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import { z } from "zod";

import { anchoredDirectoryPath, assertNotSymbolicLink, durableWrite, isWithin, JsonFileTransactionError, syncJsonTransactionDirectory } from "./json-file-transaction-fs";
import { withJsonFileTransactionLock } from "./json-file-transaction-lock";

export { JsonFileTransactionError, syncJsonTransactionDirectory } from "./json-file-transaction-fs";
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const JOURNAL_NAME = ".candidate-apply-transaction.json";
const JOURNAL_TEMP_NAME = `${JOURNAL_NAME}.tmp`;
const MAX_TRANSACTION_ENTRIES = 103;
const MAX_ENTRY_CONTENT_BYTES = 8 * 1024 * 1024;
const MAX_JOURNAL_BYTES = 64 * 1024 * 1024;

const relativePathSchema = z.string().min(1).refine(
  (value) => !isAbsolute(value) && value.split(/[\\/]/u).every((part) => part !== "" && part !== "." && part !== ".."),
  "transaction paths must be normalized relative paths",
);

const authoritativeTargetSchema = relativePathSchema.refine(
  (value) => value === "candidate-dispositions.json"
    || value === "candidate-review-decisions.json"
    || value === "candidate-terms.json"
    || /^terms\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/u.test(value),
  "transaction target is not authoritative",
);

function transactionIdFromPaths(target: string, temporary: string): string {
  const prefix = `${target}.candidate-apply-`;
  return temporary.startsWith(prefix) && temporary.endsWith(".tmp")
    ? temporary.slice(prefix.length, -4)
    : "";
}

const journalEntrySchema = z.strictObject({
  target: authoritativeTargetSchema,
  temporary: relativePathSchema,
  previousSha256: z.string().regex(HASH_PATTERN).nullable(),
  intendedSha256: z.string().regex(HASH_PATTERN),
  content: z.string().refine((value) => Buffer.byteLength(value) <= MAX_ENTRY_CONTENT_BYTES, "transaction content is too large"),
}).superRefine((entry, context) => {
  const transactionId = transactionIdFromPaths(entry.target, entry.temporary);
  if (!UUID_PATTERN.test(transactionId)) {
    context.addIssue({ code: "custom", path: ["temporary"], message: "temporary path does not match transaction target" });
  }
});

const journalSchema = z.strictObject({
  version: z.literal(1),
  entries: z.array(journalEntrySchema).min(1).max(MAX_TRANSACTION_ENTRIES),
}).superRefine((journal, context) => {
  const targets = new Set<string>();
  const transactionIds = new Set<string>();
  for (const [index, entry] of journal.entries.entries()) {
    if (targets.has(entry.target)) {
      context.addIssue({ code: "custom", path: ["entries", index, "target"], message: "transaction targets must be unique" });
    }
    targets.add(entry.target);
    transactionIds.add(transactionIdFromPaths(entry.target, entry.temporary));
  }
  if (transactionIds.size !== 1) {
    context.addIssue({ code: "custom", path: ["entries"], message: "temporary paths must share one transaction identifier" });
  }
});

type Journal = z.infer<typeof journalSchema>;

export type JsonFileWrite = {
  readonly relativePath: string;
  readonly content: string;
};

export type JsonFileTransactionHooks = {
  readonly afterRename?: (completedRenameCount: number) => void;
};

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

type ResolvedJournalEntry = {
  readonly entry: Journal["entries"][number];
  readonly parentDescriptor: number;
  readonly parentPath: string;
  readonly targetPath: string;
  readonly temporaryPath: string;
};

function resolveJournalEntries(dataDirectory: string, journal: Journal): readonly ResolvedJournalEntry[] {
  const canonicalRoot = realpathSync(dataDirectory);
  const resolvedEntries: ResolvedJournalEntry[] = [];
  try {
    for (const entry of journal.entries) {
      const relativeParent = dirname(entry.target);
      const parentPath = relativeParent === "." ? dataDirectory : join(dataDirectory, relativeParent);
      if (relativeParent !== ".") assertNotSymbolicLink(parentPath);
      const parentFlags = constants.O_RDONLY | constants.O_DIRECTORY
        | (relativeParent === "." && dataDirectory.startsWith("/proc/self/fd/") ? 0 : constants.O_NOFOLLOW);
      const parentDescriptor = openSync(parentPath, parentFlags);
      const anchoredParent = anchoredDirectoryPath(parentDescriptor, realpathSync(parentPath));
      const canonicalParent = realpathSync(anchoredParent);
      const expectedParent = relativeParent === "." ? canonicalRoot : resolve(canonicalRoot, relativeParent);
      if (canonicalParent !== expectedParent || !isWithin(canonicalRoot, canonicalParent)) {
        closeSync(parentDescriptor);
        throw new JsonFileTransactionError(`transaction target escapes authoritative data: ${entry.target}`);
      }
      const targetPath = join(anchoredParent, basename(entry.target));
      const temporaryPath = join(anchoredParent, basename(entry.temporary));
      assertNotSymbolicLink(targetPath);
      assertNotSymbolicLink(temporaryPath);
      resolvedEntries.push({ entry, parentDescriptor, parentPath: anchoredParent, targetPath, temporaryPath });
    }
    return resolvedEntries;
  } catch (error) {
    for (const resolvedEntry of resolvedEntries) closeSync(resolvedEntry.parentDescriptor);
    throw error;
  }
}

function currentSha256(path: string): string | null {
  assertNotSymbolicLink(path);
  return existsSync(path) ? sha256(readFileSync(path)) : null;
}

function completeTransaction(dataDirectory: string, journal: Journal, hooks: JsonFileTransactionHooks): void {
  const resolvedEntries = resolveJournalEntries(dataDirectory, journal);
  try {
    let completedRenameCount = 0;
    for (const resolvedEntry of resolvedEntries) {
      const { entry, targetPath, temporaryPath } = resolvedEntry;
      const currentHash = currentSha256(targetPath);
      if (currentHash === entry.intendedSha256) {
        rmSync(temporaryPath, { force: true });
        continue;
      }
      if (currentHash !== entry.previousSha256) throw new JsonFileTransactionError(`transaction target drifted: ${entry.target}`);
      assertNotSymbolicLink(targetPath);
      assertNotSymbolicLink(temporaryPath);
      durableWrite(temporaryPath, entry.content);
      assertNotSymbolicLink(targetPath);
      assertNotSymbolicLink(temporaryPath);
      renameSync(temporaryPath, targetPath);
      syncJsonTransactionDirectory(resolvedEntry.parentPath);
      completedRenameCount += 1;
      hooks.afterRename?.(completedRenameCount);
    }
    rmSync(join(dataDirectory, JOURNAL_NAME));
    syncJsonTransactionDirectory(dataDirectory);
  } finally {
    for (const resolvedEntry of resolvedEntries) closeSync(resolvedEntry.parentDescriptor);
  }
}

function previousHashesForJournal(dataDirectory: string, journal: Journal): ReadonlyMap<string, string | null> {
  const resolvedEntries = resolveJournalEntries(dataDirectory, journal);
  try {
    return new Map(resolvedEntries.map((resolvedEntry) => [
      resolvedEntry.entry.target,
      currentSha256(resolvedEntry.targetPath),
    ]));
  } finally {
    for (const resolvedEntry of resolvedEntries) closeSync(resolvedEntry.parentDescriptor);
  }
}

function parseJournal(path: string): Journal {
  assertNotSymbolicLink(path);
  try {
    if (statSync(path).size > MAX_JOURNAL_BYTES) throw new JsonFileTransactionError("candidate apply transaction journal exceeds the size limit");
    const journal = journalSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    for (const entry of journal.entries) {
      if (sha256(entry.content) !== entry.intendedSha256) throw new JsonFileTransactionError(`transaction content hash mismatch: ${entry.target}`);
    }
    return journal;
  } catch (error) {
    if (error instanceof JsonFileTransactionError) throw error;
    throw new JsonFileTransactionError("candidate apply transaction journal is malformed", { cause: error });
  }
}

function recoverUnlocked(dataDirectory: string): void {
  const journalPath = join(dataDirectory, JOURNAL_NAME);
  const journalTemporaryPath = join(dataDirectory, JOURNAL_TEMP_NAME);
  if (!existsSync(journalPath)) {
    if (existsSync(journalTemporaryPath)) {
      assertNotSymbolicLink(journalTemporaryPath);
      rmSync(journalTemporaryPath);
      syncJsonTransactionDirectory(dataDirectory);
    }
    return;
  }
  completeTransaction(dataDirectory, parseJournal(journalPath), {});
}

export function recoverJsonFileTransaction(dataDirectory: string): void {
  withJsonFileTransactionLock(dataDirectory, recoverUnlocked);
}

export function writeJsonFileTransaction(dataDirectory: string, writes: readonly JsonFileWrite[], hooks: JsonFileTransactionHooks = {}): void {
  if (writes.length === 0) return;
  withJsonFileTransactionLock(dataDirectory, (anchoredRoot) => {
    recoverUnlocked(anchoredRoot);
    const transactionId = randomUUID();
    const uncommittedJournal = journalSchema.parse({
      version: 1,
      entries: writes.map((write) => ({
        target: authoritativeTargetSchema.parse(write.relativePath),
        temporary: relativePathSchema.parse(`${write.relativePath}.candidate-apply-${transactionId}.tmp`),
        previousSha256: null,
        intendedSha256: sha256(write.content),
        content: write.content,
      })),
    });
    const previousHashes = previousHashesForJournal(anchoredRoot, uncommittedJournal);
    const journal = journalSchema.parse({
      version: 1,
      entries: uncommittedJournal.entries.map((entry) => {
        const previousSha256 = previousHashes.get(entry.target);
        if (previousSha256 === undefined && !previousHashes.has(entry.target)) {
          throw new JsonFileTransactionError(`transaction target was not resolved: ${entry.target}`);
        }
        return { ...entry, previousSha256 };
      }),
    });
    const serializedJournal = `${JSON.stringify(journal)}\n`;
    if (Buffer.byteLength(serializedJournal) > MAX_JOURNAL_BYTES) throw new JsonFileTransactionError("candidate apply transaction journal exceeds the size limit");
    const journalPath = join(anchoredRoot, JOURNAL_NAME);
    const journalTemporaryPath = join(anchoredRoot, JOURNAL_TEMP_NAME);
    try {
      assertNotSymbolicLink(journalPath);
      assertNotSymbolicLink(journalTemporaryPath);
      durableWrite(journalTemporaryPath, serializedJournal, true);
      renameSync(journalTemporaryPath, journalPath);
      syncJsonTransactionDirectory(anchoredRoot);
    } catch (error) {
      rmSync(journalTemporaryPath, { force: true });
      throw error;
    }
    completeTransaction(anchoredRoot, journal, hooks);
  });
}
