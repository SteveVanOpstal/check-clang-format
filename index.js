#!/usr/bin/env node
'use strict';

const nodegit = require('nodegit');
const path = require('path');
const spawnClangFormat = require('clang-format').spawnClangFormat;

// const XmlReader = require('xml-reader');
// const reader = XmlReader.create({stream: true});

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

async function getUnstagedChanges() {
  const repo = await repo$;
  const head = await repo.getHeadCommit();
  if (!head) {
    return [];
  }
  const diff = await nodegit.Diff.indexToWorkdir(repo, null);
  return diff.patches();
}

function linesToRanges(lineNumbers) {
  if (!lineNumbers || !lineNumbers.length) {
    return [];
  }
  if (lineNumbers.length === 1) {
    return [{start: lineNumbers[0], end: lineNumbers[0]}];
  }
  return lineNumbers.reduce((ranges, current) => {
    const lastRange = ranges[ranges.length - 1];

    if (!ranges || !ranges.length) {
      return [{start: ranges, end: current}];
    } else if (!lastRange || lastRange.end + 1 !== current) {
      ranges.push({start: current, end: current});
    } else {
      ranges[ranges.length - 1].end = current;
    }

    return ranges;
  });
}

async function gitDiff(patches$) {
  const patches = await patches$;
  const files = [];
  for (const patch of patches) {
    const hunks = await patch.hunks();
    const file = {path: patch.newFile().path(), lineRanges: []};

    for (const hunk of hunks) {
      const lines = await hunk.lines();

      const lineNumbers = [];
      for (const line of lines) {
        const originChar = String.fromCharCode(line.origin());
        if (line.newLineno() > -1) {
          if (originChar === '+') {
            lineNumbers.push(line.newLineno());
          } else if (originChar === '-') {
            lineNumbers.push(line.newLineno());
          }
        }
      }

      const lineRanges = linesToRanges(lineNumbers);
      file.lineRanges = file.lineRanges.concat(lineRanges);
    }

    files.push(file);
  }

  if (!files || !files.length) {
    return [];
  }
  if (files.length === 1) {
    return files;
  }
  return files.reduce((previous, current) => {
    if (typeof previous === 'array') {
      const index = previous.findIndex((file) => {
        return file.path === current.path;
      });
      previous[index].lineRanges.concat(current.lineRanges);
      return previous;
    } else {
      return [previous];
    }
  });
}

async function gitDiffStaged() {
  return gitDiff(getStagedChanges());
}

async function gitDiffUnstaged() {
  return gitDiff(getUnstagedChanges());
}

async function gitGetFileContent(path) {
  const repo = await repo$;
  const index = await repo.refreshIndex();
  const indexEntry = await index.getByPath(path);
  return repo.getBlob(indexEntry.id);
}

async function gitAddFile() {
  const repo = await repo$;
  const index = await repo.refreshIndex();
}

function spawnClangFormatAsync(path, input) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const subProcess = spawnClangFormat(['-style=file', '-assume-filename', path], (error) => {
      if (error) {
        console.error(error.toString());
        reject(false);
      } else {
        resolve(chunks.join());
      }
    }, 'pipe');
    subProcess.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });
    subProcess.stderr.on('data', (error) => {
      console.error(error.toString());
      reject(false);
    });
    subProcess.stdin.write(input);
    subProcess.stdin.end();
  });
}

async function formatStaged() {
  const diff = await gitDiffStaged();

  for (const file of diff) {
    // const lines = file.lineRanges.map((lineRange) => `-lines=${lineRange.start}:${lineRange.end}`);
    const content = await gitGetFileContent(file.path);
    const formattedFile = await spawnClangFormatAsync(file.path, content.toString());

    if (formattedFile) {
      // const test = await nodegit.Diff.blobToBuffer(content, null, formattedFile, null, {}, null, null, null, (que) => {
      //   console.log(que);
      // })
      // console.log(test);

      console.log(formattedFile);
    }
    // console.log(formattedFile);

    // const replacementLineRanges = [];
    // reader.on('tag:replacement', (data) => {
    //   console.log(data.attributes.offset + ' ' + data.attributes.length);
    //   // console.log(data.children[0].value.length);
    //   console.log(data.value);
    //   // replacementLineRanges.push();
    // });

    // reader.on(
    //     'done',
    //     (data) => {
    //       console.log(data);
    //     });

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
}

formatStaged()
    .then((diff) => {
      console.log(diff);
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
