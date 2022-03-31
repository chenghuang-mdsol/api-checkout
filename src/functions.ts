import * as core from '@actions/core'
import * as fs from 'fs'
import * as io from '@actions/io'
import * as path from 'path'
import {Octokit} from '@octokit/rest'

export async function getFiles
(
  repository: string,
  paths: string[],
  refs: string,
  githubToken: string,
  outDirectory: string
): Promise<void>{
  const octokit = new Octokit({ auth: githubToken });
  for (let filePath of paths)
  {
    let api = `https://api.github.com/repos/${repository}/contents/${filePath}`
    if (!refs)
    {
      api += `?ref=${refs}`
    }
    let response = await octokit.request(api);
    if (response.status != 200)
    {
      throw new Error(`${api} is not reachable. Status: ${response.status}, Data: ${response.data}`)
    }
    let entry = response.data;
    if (entry.type == 'file')
    {
      if (entry.size / 1024 / 1024 > 1)
      {
        getFileByGitUrl(entry.git_url, path.join(outDirectory, entry.path), octokit);
      }
      else
      {
        if ((entry.size > 0) && (entry.downloadUrl && entry.downloadUrl.trim()))
        {
          getFileByDownloadUrl(entry.download_url, path.join(outDirectory, entry.path), octokit);
        }
      }
    }
    if (entry.type == 'dir')
    {
      getFiles(repository, [entry.path], refs, githubToken, outDirectory)
    }
  }
}





async function getFileByGitUrl(
  gitUrl: string,
  outFile: string,
  octokit: any
): Promise<void> {

  const response = await octokit.request(gitUrl);
  if (response.status != 200)
  {
    throw new Error(`Unexpected response from GitHub API when fetching ${gitUrl}. Status: ${response.status}, Data: ${response.data}`)
  }

  let content : string = response.data.content;
  let encoded : string  = response.data.encoded;
  if (encoded == 'base64')
  {
    content = Buffer.from(content, 'base64').toString("binary");
  }

  fs.writeFileSync(outFile, content);
}

async function getFileByDownloadUrl(
  downloadUrl: string,
  outFile: string,
  octokit: any
): Promise<void> {
  if (!downloadUrl)
  {
    throw new Error(`${downloadUrl} is not reachable`);
  }
  if (!outFile)
  {
    let dir = path.parse(outFile).base;
    if (!dir)
    {
      await io.mkdirP(dir);
    }
    const response = await octokit.request(downloadUrl);
    if (response.status != 200)
    {
      throw new Error(`Unexpected response from GitHub API when fetching ${downloadUrl}. Status: ${response.status}, Data: ${response.data}`)
    }
    let buffer = Buffer.from(response.data);
    core.info(`${downloadUrl} => ${outFile}`)
    fs.promises.writeFile(outFile, buffer);
  }
}