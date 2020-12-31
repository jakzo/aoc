module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2017: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:prettier/recommended",
    "prettier/@typescript-eslint",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/typescript",
    "plugin:import/errors",
  ],
  parser: "@typescript-eslint/parser",
  plugins: [
    "@typescript-eslint/eslint-plugin",
    ...(process.env.VSCODE_PID ? ["only-warn"] : []),
  ],
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2018,
    project: "./tsconfig.json",
    tsconfigRootDir: process.cwd(),
  },
  rules: {
    //
    // Disabled rules
    //

    // Justification: Required for cases like `try { ... } catch (err) {}` and doesn't do much harm
    "no-empty": "off",
    // Justification: It is tedious for simple functions like `() => 123`
    "@typescript-eslint/explicit-function-return-type": "off",
    // Justification: Sometimes you just need a no-op and empty functions aren't a huge problem anyway
    "@typescript-eslint/no-empty-function": "off",
    // Justification: Makes using things like `Error.captureStackTrace` painful; Also errors when defining
    // polymorphic interfaces such as `interface A { b(): bool; b(x: number): bool; }`; Causes errors when applying mocks.
    "@typescript-eslint/unbound-method": "off",
    // Justification: Some functions need to be async for API requirements but await nothing
    "@typescript-eslint/require-await": "off",
    // Justification: Sometimes you want empty interfaces and they don't hurt anyone
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/restrict-template-expressions": "off",

    //
    // Modified rules
    //

    // Justification: Allow intentionally infinite loops for cases like polling
    "no-constant-condition": ["error", { checkLoops: false }],
    // Justification: Ignore pattern for cases like `const cb = (_a, b) => b + 1`
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    // Justification: This allows `() => Promise<void>` functions to be allowed when `() => void` is expected.
    "@typescript-eslint/no-misused-promises": [
      "error",
      { checksVoidReturn: false },
    ],

    //
    // Enabled rules
    //

    // Justification: Forgetting to await a promise is a common mistake
    "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
    // Justification: Cyclic dependencies are confusing and cause bugs
    "import/no-cycle": "error",
    // Justification: You should only use dependencies that exist in your package.
    "import/no-extraneous-dependencies": "error",
    // Justification: Duplicate imports are confusing.
    "import/no-duplicates": ["error", { considerQueryString: true }],
    // Justification: Keeps imports neat and readable
    "import/order": [
      "error",
      {
        "newlines-between": "always",
        groups: [
          "builtin",
          "external",
          "internal",
          ["index", "sibling", "parent"],
        ],
        alphabetize: { order: "asc" },
      },
    ],
    // Justification: same as import/order
    // Configure 'sort-imports' so it doesn't conflict with 'import/order'.
    // This sorts imports within braces, eg: import { <sorted> } from 'x';
    "sort-imports": [
      "error",
      {
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
      },
    ],

    // Justification: Readability
    "import/first": "error",
    // Justification: Readability
    "import/newline-after-import": "error",
    // Justification: Readability
    "import/no-useless-path-segments": "error",
    // Justification: Why would you ever want to do this?
    "import/no-self-import": "error",
  },
};
