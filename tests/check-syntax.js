import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(candidate) : [candidate];
  });
}

const files = walk(process.cwd()).filter((file) => file.endsWith(".js"));
for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
