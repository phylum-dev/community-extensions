import {
  green,
  red,
  yellow,
} from "https://deno.land/std@0.150.0/fmt/colors.ts";
import { PhylumApi } from "phylum";

// Find project root directory.
async function findRoot(manifest: string): Promise<string | undefined> {
  let workingDir = Deno.cwd();

  // Traverse up to 32 directories to find the root directory.
  for (let i = 0; i < 32; i++) {
    try {
      // Check if manifest exists at location.
      await Deno.stat(workingDir + "/" + manifest);
      return workingDir;
    } catch (_e) {
      // Pop to parent if manifest doesn't exist.
      workingDir += "/..";
    }
  }

  return undefined;
}

// List with all of pip's subcommands.
const knownSubcommands = [
  "install",
  "download",
  "uninstall",
  "freeze",
  "inspect",
  "list",
  "show",
  "check",
  "config",
  "search",
  "cache",
  "index",
  "wheel",
  "hash",
  "completion",
  "debug",
  "help",
];

// Ensure the first argument is a known subcommand.
//
// This prevents us from skipping the analysis when an argument is passed before
// the first subcommand (i.e.: `pip --no-color install package`).
const subcommand = Deno.args[0];
if (Deno.args.length != 0 && !knownSubcommands.includes(subcommand)) {
  console.error(`[${red("phylum")}] This extension does not support arguments before the first subcommand. Please open an issue if "${subcommand}" is not an argument.`);
}

// Ignore all commands that shouldn't be intercepted.
if (Deno.args.length == 0 || subcommand != "install") {
  const cmd = Deno.run({ cmd: ["pip", ...Deno.args] });
  const status = await cmd.status();
  Deno.exit(status.code);
}

// Analyze new dependencies with phylum before install/update.
await checkDryRun();

// Perform the package installation.
const cmd = Deno.run({ cmd: ["pip", ...Deno.args] });
const status = await cmd.status();
Deno.exit(status.code);

// Analyze new packages.
async function checkDryRun() {
  console.log(`[${green("phylum")}] Finding new dependencies…`);

  const status = PhylumApi.runSandboxed({
    cmd: "pip",
    args: [...Deno.args, "--dry-run"],
    exceptions: {
      run: ["/bin"],
      write: ["./", "~/.cache"],
      read: ["./", "~/.cache", "/etc/passwd"],
      net: true,
    },
    stdout: 'piped',
  });

  // Ensure dry-run was successful.
  if (!status.success) {
    console.error(`[${red("phylum")}] Pip dry-run failed.\n`);
    await Deno.exit(status.code);
  }

  // Parse dry-run output.
  let packages = parseDryRun(status.stdout);

  console.log(`[${green("phylum")}] Dependency resolution successful.\n`);
  console.log(`[${green("phylum")}] Analyzing packages…`);

  if (packages.length === 0) {
    console.log(`[${green("phylum")}] No new packages found for analysis.\n`);
    return;
  }

  const jobId = await PhylumApi.analyze("pypi", packages);
  const jobStatus = await PhylumApi.getJobStatus(jobId);

  if (jobStatus.pass && jobStatus.status === "complete") {
    console.log(`[${green("phylum")}] All packages pass project thresholds.\n`);
  } else if (jobStatus.pass) {
    console.warn(
      `[${
        yellow(
          "phylum",
        )
      }] Unknown packages were submitted for analysis, please check again later.\n`,
    );
    Deno.exit(126);
  } else {
    console.error(
      `[${red("phylum")}] The operation caused a threshold failure.\n`,
    );
    Deno.exit(127);
  }
}

// Parse the dry-run output of `pip install`.
function parseDryRun(output: string): [object] {
  // Extract the "Would install [..]" line.
  let new_deps;
  const lines = output.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Would install ')) {
      new_deps = lines[i].substring('Would install '.length);
      break;
    }
  }

  // No "Would install [..]" means there were no new dependencies.
  if (!new_deps) {
    return [];
  }

  // Output package list.
  const packages = [];

  // Parse dependency names and versions.
  const deps = new_deps.split(' ');
  for (var i = 0; i < deps.length; i++) {
    const dep = deps[i].split('-');
    packages.push({
      name: dep[0],
      version: dep[1],
    });
  }

  return packages;
}
