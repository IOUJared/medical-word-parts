import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function writeDurableJournal(directory: string): void {
  const content = "RECOVERED\n";
  const transactionId = randomUUID();
  writeFileSync(join(directory, ".candidate-apply-transaction.json"), `${JSON.stringify({
    version: 1,
    entries: [{
      target: "candidate-terms.json",
      temporary: `candidate-terms.json.candidate-apply-${transactionId}.tmp`,
      previousSha256: sha256("BEFORE\n"),
      intendedSha256: sha256(content),
      content,
    }],
  })}\n`);
}

const childProgram = `
  import { writeJsonFileTransaction } from "./src/data/json-file-transaction.ts";
  const directory = process.env.TRANSACTION_TEST_DIRECTORY;
  const content = process.env.TRANSACTION_TEST_CONTENT;
  if (directory === undefined || content === undefined) process.exit(3);
  try {
    writeJsonFileTransaction(directory, [{ relativePath: "candidate-terms.json", content }], {
      afterRename() {
        process.stdout.write("entered\\n");
        if (process.env.TRANSACTION_TEST_STOP === "1") process.kill(process.pid, "SIGSTOP");
      }
    });
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message : "unknown transaction failure");
    process.exitCode = 2;
  }
`;

describe("JSON file transaction lock", () => {
  it("Given a stale lock and two process reclaimers, when one reclaimer enters, then the other remains excluded in every repeated round", async () => {
    for (let round = 0; round < 10; round += 1) {
      const directory = mkdtempSync(join(tmpdir(), "candidate-transaction-reclaimers-"));
      const target = join(directory, "candidate-terms.json");
      let ownerPid: number | undefined;
      try {
        const deadOwner = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
        expect(deadOwner.status).toBe(0);
        writeFileSync(target, "BEFORE\n");
        writeDurableJournal(directory);
        writeFileSync(join(directory, ".candidate-apply-transaction.lock"), `${deadOwner.stdout}\n`);

        const owner = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", childProgram], {
          cwd: process.cwd(),
          env: { ...process.env, TRANSACTION_TEST_CONTENT: "OWNER\n", TRANSACTION_TEST_DIRECTORY: directory, TRANSACTION_TEST_STOP: "1" },
          stdio: "pipe",
        });
        ownerPid = owner.pid;
        const entered = await new Promise<string>((resolve, reject) => {
          owner.once("error", reject);
          owner.stdout.once("data", (chunk: Buffer) => resolve(chunk.toString("utf8")));
        });
        expect(entered).toContain("entered");

        const contender = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", childProgram], {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, TRANSACTION_TEST_CONTENT: "CONTENDER\n", TRANSACTION_TEST_DIRECTORY: directory },
        });
        expect(contender.status).toBe(2);
        expect(contender.stdout).not.toContain("entered");
        expect(contender.stderr).toContain("already in progress");

        const ownerExitPromise = new Promise<number | null>((resolve, reject) => {
          owner.once("error", reject);
          owner.once("close", resolve);
        });
        if (ownerPid === undefined) expect.fail("transaction owner did not expose a process identifier");
        process.kill(ownerPid, "SIGCONT");
        const ownerExit = await ownerExitPromise;
        ownerPid = undefined;
        expect(ownerExit).toBe(0);
        expect(readFileSync(target, "utf8")).toBe("OWNER\n");
        expect(readdirSync(directory).filter((name) => name.includes("candidate-apply"))).toEqual([]);
      } finally {
        if (ownerPid !== undefined) process.kill(ownerPid, "SIGCONT");
        rmSync(directory, { recursive: true, force: true });
      }
    }
  }, 30_000);
});
