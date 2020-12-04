# aoc

Full Advent of Code dev loop in a CLI including:

- Creating a template source file with testing harness for your code
- Printing the description in the terminal the moment it begins
- Downloads the input
- Runs and watches your code for changes
- Submits answers outputted by your code

## Instructions

First make sure Node.js is installed then install this tool with:

```sh
npm i -g @jakzo/aoc
```

Then a few minutes before the challenge starts, run it with:

```sh
aoc
```

This will prompt you for your session token if you haven't provided it before.

From here it will:

- Create a new source file with the test harness setup for the next challenge
- Count down until the challenge starts
- Print the description in the terminal once the challenge starts
- Download the input to a local file
- Run the test harness and rerun on changes
- After each run allow selecting a line from the output to submit
- If the answer was correct, print the description of part 2 and repeat

## Individual Commands

Documentation for individual commands (eg. printing the description of a challenge or submitting a solution) can be found by running `aoc --help`.

Individual commands can also be accessed from the npm module like:

```js
const { printDescription } = require('@jakzo/aoc')

printDescription(2020, 5)
```
