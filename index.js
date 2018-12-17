#!/usr/bin/env node
'use strict';

const nodegit = require('nodegit');
const path = require('path');
const spawnClangFormat = require('clang-format').spawnClangFormat;

const XmlReader = require('xml-reader');
const reader = XmlReader.create({stream: true});

const currentRepoPath = path.resolve(__dirname, './.git');

console.log(currentRepoPath);

const repo$ = nodegit.Repository.open(currentRepoPath);

async function getStagedChanges() {
  const repo = await repo$;
  const head = await repo.getHeadCommit();
  if (!head) {
    return [];
  }
  const diff = await nodegit.Diff.treeToIndex(repo, await head.getTree(), null);

  return diff.patches();
}

function linesToRanges(lineNumbers) {
  if (!lineNumbers) {
    return [];
  }
  if (lineNumbers.length === 1) {
    return [{first: lineNumbers[0], last: lineNumbers[0]}];
  }
  return lineNumbers.reduce((ranges, current) => {
    const lastRange = ranges[ranges.length - 1];

    if (!ranges || !ranges.length) {
      return [{first: ranges, last: current}];
    } else if (!lastRange || lastRange.last + 1 !== current) {
      ranges.push({first: current, last: current});
    } else {
      ranges[ranges.length - 1].last = current;
    }

    return ranges;
  });
}

async function gitDiffStaged() {
  const patches = await getStagedChanges();

  const files = [];
  for (const patch of patches) {
    const hunks = await patch.hunks();
    const file = {path: patch.newFile().path(), lineRanges: [], lineLenghts: []};

    for (const hunk of hunks) {
      const lines = await hunk.lines();

      const lineNumbers = [];
      for (const line of lines) {
        const originChar = String.fromCharCode(line.origin());
        if (line.newLineno() > -1) {
          if (originChar === '+') {
            lineNumbers.push(line.newLineno());
            file.lineLenghts.push(line.contentLen());
          } else if (originChar === '-') {
            lineNumbers.push(line.newLineno());
          } else {
            file.lineLenghts.push(line.contentLen());
          }
        }
      }

      const lineRanges = linesToRanges(lineNumbers);
      file.lineRanges = file.lineRanges.concat(lineRanges);
    }

    files.push(file);
  }

  return files;
}

// function clangFormat(file, lines, style, done) {
//   let args = [`-style=${style}`, '-output-replacements-xml', ...lines, file.path];
//   console.log(args);
//   let result = spawnClangFormat(args, done, ['ignore', 'pipe', process.stderr]);
//   if (result) {  // must be ChildProcess
//     return result;
//   } else {
//     // We shouldn't be able to reach this line, because it's not possible to
//     // set the --glob arg in this function.
//     throw new Error('Can\'t get output stream when --glob flag is set');
//   }
// }

async function gitAddFile() {
  const repo = await repo$;
  const index = await repo.index();
}

function offsetToLine(offset, lineLenghts) {
  return lineLenghts
      .reduce((result, current) => {
        if (!result.fileOffset) {
          return {line: 0, fileOffset: current};
        }
        if (result.fileOffset >= offset) {
          return result;
        }
        result.fileOffset += current;
        result.line += 1;
        return result;
      })
      .line;
}

gitDiffStaged()
    .then((diff) => {
      console.log(diff);

      for (const file of diff) {
        const lines = file.lineRanges.map((lineRange) => `-lines=${lineRange.first}:${lineRange.last}`);
        let args = [`-style=file`, '-output-replacements-xml', ...lines];
        const result = spawnClangFormat(args, () => {}, ['pipe', 'pipe', process.stderr]);

        // result.stdin.write(file.content);
        result.stdin.end();

        const replacementLineRanges = [];
        reader.on('tag:replacement', (data) => {
          console.log(data.attributes.offset + ' ' + data.attributes.length);
          // console.log(data.children[0].value.length);
          console.log(data.value);
          console.log(offsetToLine(data.attributes.offset, file.lineLenghts));
          // replacementLineRanges.push();
        });

        reader.on(
            'done',
            (data) => {

            });

        result.stdout.on('data', (chunk) => {
          reader.parse(chunk.toString());
        });

        // const result = clangFormat(
        //     file, lines, 'file',
        //     (que) => {

        //     });
        // result.stdout.on('data', (data) => {
        //   if (data.indexOf('</replacement>') > -1) {
        //     let args = [`-style=file`, '-i', ...lines, file.path];
        //     spawnClangFormat(args, done, ['ignore', 'pipe', process.stderr]);
        //     gitAddFile().then();
        //   }
        // });
      }
    })
    .catch((err) => {
      console.log(err);
    });



// const clangformat = require('clang-format');
// const spawn = require('child_process').spawnSync;
// const process = require('process');
// const os = require('os');
// const path = require('path');

// let gitCLangFormatBinary = 'git-clang-format';
// if (os.platform() === 'win32') {
//   gitCLangFormatBinary = 'git-clang-format.cmd';
// }

// function main() {
//   let clangFormatPath;

//   try {
//     clangFormatPath = path.dirname(require.resolve('clang-format'));
//   } catch (e) {
//     clangFormatPath = '.';
//   }

//   const gitClangFormatPath = path.join(clangFormatPath, '../.bin/' +
//   gitCLangFormatBinary); const result = spawn(gitClangFormatPath,
//     [
//       '--style=file',
//       '--binary=' + clangformat.getNativeBinary().replace(/\\/g, '/',)
//     ], {encoding: 'utf-8'});

//   if (result.error) {
//     console.error('Error running git-clang-format:', result.error);
//     return 2;
//   }

//   const clangFormatOutput = result.stdout.trim();
//   console.error(result.stderr);
//   console.error(result.stdout);
//   if (clangFormatOutput.indexOf('no modified files to format') < 0 &&
//       clangFormatOutput.indexOf('clang-format did not modify any files') <
//       0) {
//     console.error(clangFormatOutput);
//     console.error(`ERROR: please check in the changes made by clang-format`);
//     return 1;
//   }
// }

// if (require.main === module) {
//   process.exitCode = main();
// }
