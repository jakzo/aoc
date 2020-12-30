> **NOTE: A lot of these templates are unfinished and may not work correctly.**

Each directory here holds the files for a language template.

## Creating a New Template

- Create a directory here with the name of the template.
- Add the source template file here, along with any other supporting files (if necessary).
  - The source file should read all input from `input.txt` into a string and output a result of `0`.
  - Try to add only a single source file. Do not add package manager or project boilerplate since it will complicate this tool and require specific setups from end users. The idea is that a user could easily switch between languages for a single challenge and the directory would contain a list of source files, rather than projects. Rust is an exception since VSCode extensions require a `Cargo.toml` to work correctly (I'd like to get rid of it if possible).
  - Include `wip` (case-insensitive) in the source file name if possible since that is how the tool identifies the source file which should be saved on successful submission.
- After adding the files to a folder in this directory, add the run command(s) for the template to [`src/templates.ts`](../src/templates.ts).
  - If intermediary files are created during compilation, save them in `ctx.tempDir`.
