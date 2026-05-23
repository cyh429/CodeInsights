import { describe, expect, test } from 'bun:test'
import {
  getChatToolTone,
  getParentPath,
  getPathDisplay,
  getWelcomeActions,
} from './ui6-view-model'

describe('UI-6 view model', () => {
  test('welcome exposes no more than three direct actions', () => {
    const actions = getWelcomeActions()

    expect(actions).toHaveLength(3)
    expect(actions.map((action) => action.id)).toEqual(['pipeline', 'agent', 'settings'])
  })

  test('chat tool tone follows Agent semantic status order', () => {
    expect(getChatToolTone(false, false)).toBe('running')
    expect(getChatToolTone(true, false)).toBe('success')
    expect(getChatToolTone(true, true)).toBe('danger')
  })

  test('path display keeps the last segments and preserves short paths', () => {
    expect(getPathDisplay('/Users/zq/project/src/components/FileBrowser.tsx')).toBe('.../src/components/FileBrowser.tsx')
    expect(getPathDisplay('/project')).toBe('/project')
  })

  test('parent path supports POSIX and Windows separators', () => {
    expect(getParentPath('/Users/zq/project/file.ts')).toBe('/Users/zq/project')
    expect(getParentPath('C:\\Users\\zq\\project\\file.ts')).toBe('C:\\Users\\zq\\project')
  })
})
