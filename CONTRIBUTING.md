Contributions are welcome! 😄 Feel free to open a PR for small fixes or open an issue for bigger changes, discussion or if unsure about how to implement something.

## Dev Instructions

Install dependencies with:

```sh
yarn
```

To test the tool during development instead of running `aoc [args...]` run:

```sh
yarn dev [args...]
```

To test the tool in production mode run:

```sh
yarn build
yarn link
```

Now you will be able to use the tool with `aoc [args...]` from the files in `dist/`. If you update the source code you will need to run `yarn build` again to update the files in `dist/`.
