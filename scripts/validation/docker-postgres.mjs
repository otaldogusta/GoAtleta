import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const image = "postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94";

function docker(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { windowsHide: true, timeout });
    let output = "";
    let errors = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { errors += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve(output.trim())
      : reject(new Error(`Docker exited ${code}: ${errors.trim()}`)));
  });
}

function openSession(container) {
  const child = spawn("docker", ["exec", "-i", container,
    "psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-U", "postgres"], {
    windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  let errors = "";
  let pending = null;
  let failure = null;
  const fail = (error) => {
    failure = error;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pending = null;
    }
  };
  child.stderr.on("data", (chunk) => { errors += chunk; });
  child.stdout.on("data", (chunk) => {
    output += chunk;
    if (!pending || !output.includes(pending.marker)) return;
    const result = output.slice(0, output.indexOf(pending.marker)).trim();
    output = output.slice(output.indexOf(pending.marker) + pending.marker.length).trimStart();
    const operation = pending;
    pending = null;
    clearTimeout(operation.timer);
    operation.resolve(result);
  });
  child.on("error", fail);
  child.stdin.on("error", fail);
  child.on("close", (code) => fail(new Error(`psql closed (${code}): ${errors.trim()}`)));
  return {
    run(sql) {
      if (failure) return Promise.reject(failure);
      if (pending) return Promise.reject(new Error("A session cannot run overlapping commands"));
      return new Promise((resolve, reject) => {
        const marker = `complete_${randomUUID()}`;
        const timer = setTimeout(() => {
          fail(new Error("PostgreSQL test command exceeded 20 seconds"));
          child.kill();
        }, 20000);
        pending = { resolve, reject, marker, timer };
        child.stdin.write(`${sql}\n\\echo ${marker}\n`);
      });
    },
    close() { child.stdin.end(); },
  };
}

// No remote URL, host port, bind mount or production credential is accepted.
// Every run owns exactly one disposable container and an in-memory data volume.
export async function withDockerPostgres(run) {
  const name = `goatleta-pg-audit-${randomUUID()}`;
  let container;
  const sessions = [];
  try {
    container = await docker(["run", "--detach", "--rm", "--name", name,
      "--network", "none", "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,size=256m",
      "-e", "POSTGRES_HOST_AUTH_METHOD=trust", image], 120000);
    if (!/^[a-f0-9]{64}$/.test(container)) throw new Error("Invalid owned container ID");
    const deadline = Date.now() + 45000;
    for (;;) {
      try {
        await docker(["exec", container, "pg_isready", "-U", "postgres"], 5000);
        break;
      } catch (error) {
        if (Date.now() >= deadline) throw error;
        await delay(250);
      }
    }
    const connect = async (applicationName) => {
      if (!/^[a-z0-9_-]+$/.test(applicationName)) throw new Error("Invalid test session name");
      const session = openSession(container);
      sessions.push(session);
      await session.run(`set application_name = '${applicationName}';
        set statement_timeout = '15s'; set idle_in_transaction_session_timeout = '20s';`);
      return session;
    };
    console.log(`[postgres-concurrency] ${image}; isolated container; independent psql sessions`);
    return await run({ connect });
  } finally {
    for (const session of sessions) session.close();
    // Only remove the exact container returned by this invocation, never a wildcard.
    if (container && /^[a-f0-9]{64}$/.test(container)) await docker(["rm", "--force", container]);
  }
}
