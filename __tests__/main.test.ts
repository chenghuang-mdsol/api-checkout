import {getFiles} from '../src/functions'
import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import {expect, test} from '@jest/globals'

test('throws invalid api call', async () => {
  const input = parseInt('foo', 10)
  await expect(getFiles("abc",["abc"],"","invalid token",".")).rejects.toThrow()
})
