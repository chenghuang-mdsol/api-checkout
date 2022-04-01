import * as core from '@actions/core'
import * as fs from 'fs'
import * as io from '@actions/io'
import * as oct from '@octokit/rest'
import * as octTypes from '@octokit/types'
import * as path from 'path'

interface ContentAPIEntry {
  name: string
  path: string
  size: number
  git_url: string
  download_url: string
  type: string
}

interface GithubErrorMessage {
  message: string
}

export async function getFiles(
  repository: string,
  paths: string[],
  refs: string,
  githubToken: string,
  outDirectory: string
): Promise<void> {
  await io.mkdirP(outDirectory)
  const octokit = new oct.Octokit({auth: githubToken})
  for (const filePath of paths) {
    let api = `https://api.github.com/repos/${repository}/contents/${filePath}`
    let apiParent = path.parse(api).dir
    let data: ContentAPIEntry[]
    if (refs && refs.trim()) {
      api += `?ref=${refs}`
      apiParent += `?ref=${refs}`
    }

    let response: octTypes.OctokitResponse<ContentAPIEntry[], number>
    try {
      response = await octokit.request(api)
      data = response.data
    } catch (err) {
      if (
        (err as GithubErrorMessage).message.includes(
          'This API returns blobs up to 1 MB in size'
        )
      ) {
        response = await octokit.request(apiParent)
        data = [
          response.data.filter(function (p: ContentAPIEntry) {
            return p.path === filePath
          })[0]
        ]
      } else {
        throw new Error(`${api} is not reachable. Status: ${err}`)
      }
    }

    for (const entry of data) {
      if (entry.type === 'file') {
        if (entry.size / 1024 / 1024 > 1) {
          getFileByGitUrl(
            entry.git_url,
            path.join(outDirectory, entry.path),
            octokit
          )
        } else {
          if (
            entry.size > 0 &&
            entry.download_url &&
            entry.download_url.trim()
          ) {
            getFileByDownloadUrl(
              entry.download_url,
              path.join(outDirectory, entry.path),
              octokit
            )
          }
        }
      }
      if (entry.type === 'dir') {
        getFiles(repository, [entry.path], refs, githubToken, outDirectory)
      }
    }
  }
}

async function getFileByGitUrl(
  gitUrl: string,
  outFile: string,
  octokit: oct.Octokit
): Promise<void> {
  const response = await octokit.request(gitUrl)
  if (response.status !== 200) {
    throw new Error(
      `Unexpected response from GitHub API when fetching ${gitUrl}. Status: ${response.status}, Data: ${response.data}`
    )
  }

  let content: string = response.data.content
  const encoded: string = response.data.encoding
  if (encoded === 'base64') {
    content = Buffer.from(content, 'base64').toString('binary')
  }
  const dir = path.parse(outFile).dir
  await io.mkdirP(dir)
  fs.writeFile(outFile, content, function () {
    core.info(`${gitUrl} => ${outFile}`)
  })
}

async function getFileByDownloadUrl(
  downloadUrl: string,
  outFile: string,
  octokit: oct.Octokit
): Promise<void> {
  if (!downloadUrl) {
    throw new Error(`${downloadUrl} is not reachable`)
  }

  const dir = path.parse(outFile).dir
  await io.mkdirP(dir)
  const response = await octokit.request(downloadUrl)
  if (response.status !== 200) {
    throw new Error(
      `Unexpected response from GitHub API when fetching ${downloadUrl}. Status: ${response.status}, Data: ${response.data}`
    )
  }
  const buffer = Buffer.from(response.data)
  fs.writeFile(outFile, buffer, function () {
    core.info(`${downloadUrl} => ${outFile}`)
  })
}
