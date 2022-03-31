import * as core from '@actions/core'
import * as io from '@actions/io'
import * as path from 'path'
import {Octokit} from '@octokit/rest'
import {getFiles} from './functions'

async function run(): Promise<void> {
  try {
    const repository: string = core.getInput('repository')
    const outDirectory: string = core.getInput('out-directory')
    const paths: string[] = core.getInput('paths').split('\r?\n')
    const githubToken: string = core.getInput('github-token')
    const refs: string = core.getInput('refs')

    await getFiles(repository, paths, refs, githubToken, outDirectory);

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
