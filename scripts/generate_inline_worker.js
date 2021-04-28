#!/usr/bin/env node
/**
 * ============= generate_inline_worker.js =============
 *
 * == What is this?
 *
 * This script helps with the generation of an "inline WebWorker", that is a
 * JS Worker whose code can be contained directly in the JavaScript file that
 * needs it (instead of relying on a supplementary URL).
 *
 * Basically it generates a file which will export a stringified version of the
 * Worker file.
 * An URL linking to this string can then be created through the usage of the
 * `URL.createObjectUrl` and `Blob` browser APIs.
 * This URL can then be used directly on the Worker constructor to initiate the
 * corresponding Worker.
 *
 *
 * == How to use it?
 *
 * Using this script should be straightforward:
 * ```sh
 * node generate_inline_worker PATH_TO_INPUT_FILE PATH_TO_OUTPUT_FILE
 * ```
 *
 * Where `PATH_TO_INPUT_FILE` is the path to the worker you want to create an
 * inline version of and `PATH_TO_OUTPUT_FILE` being the corresponding module
 * exporting that Worker's code as a string.
 */

const { access, readFile, writeFile } = require("fs/promises");

run();

async function run() {
  try {
    const [input, output] = extractFileNamesFromArgs();
    await access(input);
    const fileContent = await readFile(input);
    const stringifiedContent =
      `export default ${JSON.stringify(fileContent.toString())};`;
    await writeFile(output, stringifiedContent);
    console.log(`Succeeded to create inline version for Worker ${input} at: ${output}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

function extractFileNamesFromArgs() {
  const processArgs = process.argv.slice(2);

  if (processArgs.length < 2) {
   throw new Error("Error: Missing input and output filenames argument (in that order).");
  }

  return [processArgs[0], processArgs[1]];
}
