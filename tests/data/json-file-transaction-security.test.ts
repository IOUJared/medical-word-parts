import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { recoverJsonFileTransaction, syncJsonTransactionDirectory, writeJsonFileTransaction } from "../../src/data/json-file-transaction";

function sha256(content: string): string { return createHash("sha256").update(content).digest("hex"); }
function journalEntry(target: string, temporary: string, previous: string | null, content: string) {
  return { target, temporary, previousSha256: previous, intendedSha256: sha256(content), content };
}
function writeJournal(directory: string, entries: readonly ReturnType<typeof journalEntry>[]): void {
  writeFileSync(join(directory, ".candidate-apply-transaction.json"), `${JSON.stringify({ version: 1, entries })}\n`);
}

describe("JSON file transaction security", () => {
  it("Given a durable journal and a lock whose child-process owner exited, when recovery runs, then it completes the journal and removes transaction residue", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-transaction-dead-owner-"));
    const target = join(directory, "candidate-terms.json");
    try {
      const owner = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
      expect(owner.status).toBe(0);
      writeFileSync(target, "BEFORE\n");
      writeJournal(directory, [journalEntry("candidate-terms.json", `candidate-terms.json.candidate-apply-${randomUUID()}.tmp`, sha256("BEFORE\n"), "AFTER\n")]);
      writeFileSync(join(directory, ".candidate-apply-transaction.lock"), `${owner.stdout}\n`);

      recoverJsonFileTransaction(directory);

      expect(readFileSync(target, "utf8")).toBe("AFTER\n");
      expect(readdirSync(directory).filter((name) => name.includes("candidate-apply"))).toEqual([]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("Given a child is killed after publishing a durable journal, when a new process recovers, then the dead process-instance lock is reclaimed", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-transaction-killed-owner-"));
    const target = join(directory, "candidate-terms.json");
    try {
      writeFileSync(target, "BEFORE\n");
      const crashed = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", `
        import { writeJsonFileTransaction } from "./src/data/json-file-transaction.ts";
        const directory = process.env.TRANSACTION_TEST_DIRECTORY;
        if (directory === undefined) process.exit(3);
        writeJsonFileTransaction(directory, [{ relativePath: "candidate-terms.json", content: "AFTER\\n" }], {
          afterRename() { process.kill(process.pid, "SIGKILL"); }
        });
      `], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, TRANSACTION_TEST_DIRECTORY: directory } });
      expect(crashed.signal).toBe("SIGKILL");
      expect(existsSync(join(directory, ".candidate-apply-transaction.json"))).toBe(true);
      expect(existsSync(join(directory, ".candidate-apply-transaction.lock"))).toBe(true);

      recoverJsonFileTransaction(directory);

      expect(readFileSync(target, "utf8")).toBe("AFTER\n");
      expect(readdirSync(directory).filter((name) => name.includes("candidate-apply"))).toEqual([]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("Given a malformed crash-created lock, when recovery runs, then it fails closed without changing the durable journal", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-transaction-malformed-lock-"));
    const target = join(directory, "candidate-terms.json");
    try {
      writeFileSync(target, "BEFORE\n");
      writeJournal(directory, [journalEntry("candidate-terms.json", `candidate-terms.json.candidate-apply-${randomUUID()}.tmp`, sha256("BEFORE\n"), "AFTER\n")]);
      writeFileSync(join(directory, ".candidate-apply-transaction.lock"), "7");

      expect(() => recoverJsonFileTransaction(directory)).toThrow(/already in progress/);

      expect(readFileSync(target, "utf8")).toBe("BEFORE\n");
      expect(existsSync(join(directory, ".candidate-apply-transaction.json"))).toBe(true);
      expect(readFileSync(join(directory, ".candidate-apply-transaction.lock"), "utf8")).toBe("7");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("Given a forged journal and symlinked terms ancestor, when recovery runs, then it rejects before changing the outside file", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-transaction-data-"));
    const outside = mkdtempSync(join(tmpdir(), "candidate-transaction-outside-"));
    const outsideTarget = join(outside, "victim.json");
    try {
      writeFileSync(outsideTarget, "SAFE\n");
      symlinkSync(outside, join(directory, "terms"));
      writeJournal(directory, [journalEntry("terms/victim.json", `terms/victim.json.candidate-apply-${randomUUID()}.tmp`, sha256("SAFE\n"), "PWNED\n")]);
      expect(() => recoverJsonFileTransaction(directory)).toThrow(/symbolic link|authoritative/);
      expect(readFileSync(outsideTarget, "utf8")).toBe("SAFE\n");
      expect(readdirSync(outside)).toEqual(["victim.json"]);
    } finally { rmSync(directory, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
  });


  it("Given a new authoritative write through a symlinked terms parent, when the transaction starts, then it rejects before publishing a journal", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-transaction-new-data-"));
    const outside = mkdtempSync(join(tmpdir(), "candidate-transaction-new-outside-"));
    const outsideTarget = join(outside, "victim.json");
    try {
      writeFileSync(outsideTarget, "SAFE\n");
      symlinkSync(outside, join(directory, "terms"));

      expect(() => writeJsonFileTransaction(directory, [{ relativePath: "terms/victim.json", content: "PWNED\n" }])).toThrow(/symbolic link|authoritative/);

      expect(readFileSync(outsideTarget, "utf8")).toBe("SAFE\n");
      expect(existsSync(join(directory, ".candidate-apply-transaction.json"))).toBe(false);
      expect(readdirSync(outside)).toEqual(["victim.json"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
  it("Given a journal with a mismatched temporary path, when recovery runs, then it rejects without residue mutation", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-transaction-pair-"));
    const target = join(directory, "candidate-terms.json");
    try {
      writeFileSync(target, "SAFE\n");
      writeJournal(directory, [journalEntry("candidate-terms.json", `candidate-review-decisions.json.candidate-apply-${randomUUID()}.tmp`, sha256("SAFE\n"), "PWNED\n")]);
      expect(() => recoverJsonFileTransaction(directory)).toThrow(/malformed|temporary/);
      expect(readFileSync(target, "utf8")).toBe("SAFE\n");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("Given an unbounded journal, when recovery runs, then it rejects before changing authoritative data", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-transaction-bounds-"));
    const target = join(directory, "candidate-terms.json");
    try {
      writeFileSync(target, "SAFE\n");
      writeJournal(directory, Array.from({ length: 104 }, () => journalEntry("candidate-terms.json", `candidate-terms.json.candidate-apply-${randomUUID()}.tmp`, sha256("SAFE\n"), "PWNED\n")));
      expect(() => recoverJsonFileTransaction(directory)).toThrow(/malformed|entries/);
      expect(readFileSync(target, "utf8")).toBe("SAFE\n");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("Given an active transaction, when a concurrent transaction enters at the rename seam, then it fails closed and leaves one valid result", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-transaction-collision-"));
    let outerLockPreserved = false;
    let collision = "";
    try {
      writeFileSync(join(directory, "candidate-terms.json"), "BEFORE\n");
      writeJsonFileTransaction(directory, [{ relativePath: "candidate-terms.json", content: "FIRST\n" }], { afterRename() {
        try { writeJsonFileTransaction(directory, [{ relativePath: "candidate-terms.json", content: "SECOND\n" }]); }
        catch (error) { collision = error instanceof Error ? error.message : "unknown collision"; }
        outerLockPreserved = existsSync(join(directory, ".candidate-apply-transaction.lock"));
      } });
      expect(collision).toContain("already in progress");
      expect(outerLockPreserved).toBe(true);
      expect(readFileSync(join(directory, "candidate-terms.json"), "utf8")).toBe("FIRST\n");
      expect(readdirSync(directory).filter((name) => name.includes("candidate-apply"))).toEqual([]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("Given Windows directory durability semantics, when directory sync is requested, then it skips only that unsupported platform seam", () => {
    expect(() => syncJsonTransactionDirectory(join(tmpdir(), `missing-${randomUUID()}`), "win32")).not.toThrow();
    expect(() => syncJsonTransactionDirectory(join(tmpdir(), `missing-${randomUUID()}`), "linux")).toThrow();
  });

  it("Given a normal authoritative write, when a transaction completes and recovers, then content is durable and no transaction residue remains", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-transaction-normal-"));
    try {
      writeFileSync(join(directory, "candidate-terms.json"), "BEFORE\n");
      writeJsonFileTransaction(directory, [{ relativePath: "candidate-terms.json", content: "AFTER\n" }]);
      recoverJsonFileTransaction(directory);
      expect(readFileSync(join(directory, "candidate-terms.json"), "utf8")).toBe("AFTER\n");
      expect(readdirSync(directory).filter((name) => name.includes("candidate-apply"))).toEqual([]);
      expect(existsSync(join(directory, ".candidate-apply-transaction.json"))).toBe(false);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
