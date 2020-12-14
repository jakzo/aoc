import fs from 'fs'
import path from 'path'

const templateCommands = {
  js: ['node', './wip.js'],
}

export interface AocTemplateNormalized {
  path: string
  command: string
  args: string[]
  files?: string[]
}
export type AocTemplate = AocTemplateNormalized | AocTemplateBuiltin

export type AocTemplateBuiltin = keyof typeof templateCommands

export const builtinTemplates: Record<AocTemplateBuiltin, AocTemplateNormalized> = Object.assign(
  {},
  ...Object.entries(templateCommands).map(
    ([name, [command, ...args]]): Record<string, AocTemplateNormalized> => {
      const templatePath = path.join(__dirname, '..', 'templates', name)
      return {
        [name]: {
          path: templatePath,
          command,
          args,
          files: fs.readdirSync(templatePath),
        },
      }
    },
  ),
)
