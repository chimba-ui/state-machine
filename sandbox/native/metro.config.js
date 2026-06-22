// Monorepo Metro config: watch the workspace root so Metro picks up the linked
// @dunky.dev/* + @sandbox/* source packages, and resolve modules from both the
// app's and the root's node_modules. Mirrors the standard Expo monorepo setup.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

module.exports = config
