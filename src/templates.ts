import fs from 'fs'
import path from 'path'

const declareTemplates = <K extends string>(commands: Record<K, CommandBuilder>) => commands

const templateCommands = declareTemplates({
  'assembly-x86-mac': ctx => [
    {
      command: 'nasm',
      args: [
        '-f',
        'macho64',
        '-g',
        '-F',
        'dwarf',
        '-o',
        path.join(ctx.tempDir, 'wip.o'),
        'wip.asm',
      ],
    },
    {
      command: 'ld',
      args: [
        '-macosx_version_min',
        '10.8',
        '-no_pie',
        '-lc',
        '-o',
        path.join(ctx.tempDir, 'wip'),
        path.join(ctx.tempDir, 'wip.o'),
      ],
    },
    { command: path.join(ctx.tempDir, 'wip') },
  ],
  c: ctx => [
    { command: 'clang', args: ['-o', path.join(ctx.tempDir, 'wip'), 'wip.c'] },
    { command: path.join(ctx.tempDir, 'wip') },
  ],
  js: () => [{ command: 'node', args: ['wip.js'] }],
  java: ctx => [
    { command: 'javac', args: ['-d', ctx.tempDir, 'Main.wip.java'] },
    { command: 'java', args: ['-classpath', ctx.tempDir, 'Main'] },
  ],
  python: () => [{ command: 'python', args: ['wip.py'] }],
  ruby: () => [{ command: 'ruby', args: ['wip.rb'] }],
  rust: ctx => [
    { command: 'rustc', args: ['-o', path.join(ctx.tempDir, 'wip'), 'wip.rs'] },
    { command: path.join(ctx.tempDir, 'wip') },
  ],
})

export interface CommandBuilder {
  (ctx: { tempDir: string }): { command: string; args?: string[]; cwd?: string }[]
}

export interface AocTemplateNormalized {
  path: string
  commandBuilder: CommandBuilder
  files?: string[]
}
export type AocTemplate = AocTemplateNormalized | AocTemplateBuiltin

export type AocTemplateBuiltin = keyof typeof templateCommands

export const builtinTemplates: Record<AocTemplateBuiltin, AocTemplateNormalized> = Object.assign(
  {},
  ...Object.entries(templateCommands).map(
    ([name, commandBuilder]): Record<string, AocTemplateNormalized> => {
      const templatePath = path.join(__dirname, '..', 'templates', name)
      return {
        [name]: {
          path: templatePath,
          commandBuilder,
          files: fs.readdirSync(templatePath),
        },
      }
    },
  ),
)
