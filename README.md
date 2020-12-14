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

Then a few minutes before the challenge starts, open two terminals and run this in both:

```sh
aoc
```

This will prompt you for your session token if you haven't provided it before.

From here the first terminal will:

- Count down until the challenge starts
- Print the description in the terminal once the challenge starts
- Download the input to a local file
- When a correct answer is submitted, repeat the last two steps for part 2

And the second terminal will:

- Create a new source file with the test harness setup for the next challenge
- Run the test harness and rerun on changes
- After each run allow selecting a line from the output to submit

## Individual Commands

Documentation for individual commands (eg. printing the description of a challenge or submitting a solution) can be found by running `aoc --help`.

Individual commands can also be accessed from the npm module like:

```js
const { printDescription } = require('@jakzo/aoc')

printDescription(2020, 5)
```
