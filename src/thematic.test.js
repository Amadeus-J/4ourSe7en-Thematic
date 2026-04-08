/* test, expect, jest */
'use strict'

let logMessages = []
console.log = function (f) { logMessages.push(f) }

let menus = []
let locals = {
  userThemes: [{ type: 'theme', id: 'usertheme@usertheme.org', name: 'user', description: 'A user theme.' }
  ]
}
let syncs = {
  minutes: 15,
  auto: true
}
let enabled = []

const clearCalledWith = []
const createCalledWith = []
const managementInstalledListeners = []
const managementUninstalledListeners = []
const menuClickListeners = []
const commandListeners = []

function getMem (key, memory) {
  // console.error(key)
  // console.error(memory)
  if (typeof key === 'undefined') {
    return Promise.resolve(memory)
  }

  if (typeof memory[key] === 'undefined') {
    return Promise.resolve({})
  }

  return Promise.resolve(memory[key])
}

/* eslint-disable no-global-assign */
global.browser = {
  alarms: {
    clear: function (f) {
      clearCalledWith.push(f)
    },
    create: function (f, t) {
      createCalledWith.push([f, t])
    },
    onAlarm: {
      onAlarmAddListenerCalledWith: [],
      addListener: function (f) {
        this.onAlarmAddListenerCalledWith.push(f)
        return undefined
      }
    }
  },
  storage: {
    sync: {
      get: function (f) {
        if (typeof f === 'undefined') {
          return Promise.resolve({ ...syncs })
        }
        return Promise.resolve({ [f]: syncs[f] })
      },
      set: function (f) {
        syncs = { ...syncs, ...f }
        return Promise.resolve()
      }
    },
    local: {
      get: function (f) {
        return getMem(f, locals)
      },
      set: function (f) {
        locals = { ...locals, ...f }
        return Promise.resolve()
      }
    }
  },
  runtime: {
    onMessage: {
      addListener: function (f) { return undefined }
    },
    getBrowserInfo: function () {
      return Promise.resolve({ name: 'Firefox' })
    },
    sendMessage: function () {
      return Promise.resolve()
    }
  },
  commands: {
    onCommand: {
      addListener: function (f) {
        commandListeners.push(f)
      }
    }
  },
  management: {
    getAll: function (f) {
      const builtins = [
        { type: 'theme', id: 'default-theme@mozilla.org', name: 'Default', description: 'A theme with the operating system color scheme.' },
        { type: 'theme', id: 'firefox-compact-dark@mozilla.org', name: 'Dark', description: 'A theme with a dark color scheme.' },
        { type: 'theme', id: 'firefox-compact-light@mozilla.org', name: 'Light', description: 'A theme with a light color scheme.' },
        { type: 'theme', id: 'firefox-alpenglow@mozilla.org', name: 'Firefox Alpenglow', description: 'Use a colorful appearance for buttons, menus, and windows.' },
        { type: 'extension', id: 'drsjb80@gmail.com', name: 'Thematic', description: 'Quickly switch between your themes or back to the default.' },
        { type: 'extension', id: 'yahoo@search.mozilla.org', name: 'Yahoo!', description: 'Yahoo' },
        { type: 'extension', id: 'startpage@search.mozilla.org', name: 'Startpage', description: 'Startpage' },
        { type: 'extension', id: 'duckduckgo@search.mozilla.org', name: 'DuckDuckGo', description: 'Search DuckDuckGo' },
        { type: 'extension', id: 'wikipedia@search.mozilla.org', name: 'Wikipedia (en)', description: 'Wikipedia, the Free Encyclopedia' }
      ]
      return Promise.resolve(builtins)
    },
    setEnabled: function (variable, value) {
      // console.error([variable, value])
      enabled.push([variable, value])
    },
    onInstalled: {
      addListener: function (f) {
        managementInstalledListeners.push(f)
      }
    },
    onUninstalled: {
      addListener: function (f) {
        managementUninstalledListeners.push(f)
      }
    }
  },
  menus: {
    create: function (item) { menus.push(item) },
    removeAll: function (f) { menus = []; return Promise.resolve() },
    onClicked: {
      addListener: function (f) {
        menuClickListeners.push(f)
      }
    }
  }
}

/*
browser.runtime.onMessage.addListener('foo')
browser.alarms.clear('rotate')
browser.alarms.onAlarm.addListener('foo')
browser.commands.onCommand.addListener('foo')
browser.management.onInstalled.addListener('foo')
browser.management.onUninstalled.addListener('foo')
browser.management.setEnabled('foo', true)
browser.management.setEnabled('foo'.id, true)
browser.menus.create()
browser.menus.onClicked.addListener('foo')
browser.menus.removeAll().then(() => {})
browser.storage.sync.get('auto').then((pref) => {})
browser.storage.sync.set({ auto: false }).then(() => {})
*/

const thematic = require('./thematic.js')

const aBunchOfThemes = [
  { name: 'Theme one', id: 'one' },
  { name: 'Theme two', id: 'two' },
  { name: 'Theme three', id: 'three' },
  { name: 'Theme four', id: 'four' }
]

test('isDefaultTheme', () => {
  expect(thematic.isDefaultTheme({ id: 'foo' })).toBe(false)
  expect(thematic.isDefaultTheme({ id: 'default-theme@mozilla.org' })).toBe(true)
})

test('chooseNext', async () => {
  let items = { userThemes: [1, 2] }
  syncs.random = false
  expect(await thematic.chooseNext(0, items)).toBe(1)
  expect(await thematic.chooseNext(1, items)).toBe(0)
  syncs.random = true
  expect(await thematic.chooseNext(0, items)).toBe(1)
  expect(await thematic.chooseNext(1, items)).toBe(0)

  jest.spyOn(Math, 'random')
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.5)
  expect(await thematic.chooseNext(0, { userThemes: [1, 2, 3] })).toBe(1)
  Math.random.mockRestore()

  jest.spyOn(Math, 'random')
    .mockReturnValueOnce(0.85)
    .mockReturnValueOnce(0.15)
  expect(await thematic.chooseNext(2, { userThemes: [1, 2, 3] })).toBe(0)
  Math.random.mockRestore()

  items = { userThemes: [1, 2, 3] }
  syncs.random = false
  expect(await thematic.chooseNext(0, items)).toBe(1)
  expect(await thematic.chooseNext(1, items)).toBe(2)
  expect(await thematic.chooseNext(2, items)).toBe(0)

  /* this locks up jest for no apparent reason
  syncs.random = true
  expect(await thematic.chooseNext(0, items)).not.toBe(0)
  */
})

test('getCurrentId', () => {
  expect(thematic.getCurrentId({ currentId: 'foo' }, [], {})).toBe('foo')

  expect(thematic.getCurrentId({}, [{ id: 'foo' }], {})).toBe('foo')
  expect(logMessages.pop()).toBe('Setting currentId to first user theme')

  expect(thematic.getCurrentId({}, [], { id: 'foo' })).toBe('foo')
  expect(logMessages.pop()).toBe('Setting currentId to default theme')
})

test('getDefaultTheme', () => {
  logMessages = []
  let theme = { name: 'Default', id: 'default-theme@mozilla.org' }
  expect(thematic.getDefaultTheme([theme])).toBe(theme)

  theme = { name: 'Light', id: 'firefox-compact-light@mozilla.org' }
  expect(thematic.getDefaultTheme([theme])).toBe(theme)

  theme = { name: 'foo', id: 'foo' }
  expect(thematic.getDefaultTheme([theme])).toBeUndefined()
  expect(logMessages.pop()).toBe('No default theme found!')
})

test('buildToolsMenuItem', () => {
  const expected = [{ id: 'one', type: 'normal', title: 'Theme one', contexts: ['tools_menu'] }]
  menus = []
  thematic.buildToolsMenuItem(aBunchOfThemes[0])
  expect(menus).toStrictEqual(expected)
})

test('buildThemes', async () => {
  locals = {}
  menus = []
  const expected = {
    currentId: 'default-theme@mozilla.org',
    defaultTheme: {
      type: 'theme',
      id: 'default-theme@mozilla.org',
      name: 'Default',
      description: 'A theme with the operating system color scheme.'
    },
    defaultThemes: [
      {
        type: 'theme',
        id: 'default-theme@mozilla.org',
        name: 'Default',
        description: 'A theme with the operating system color scheme.'
      },
      {
        type: 'theme',
        id: 'firefox-compact-dark@mozilla.org',
        name: 'Dark',
        description: 'A theme with a dark color scheme.'
      },
      {
        type: 'theme',
        id: 'firefox-compact-light@mozilla.org',
        name: 'Light',
        description: 'A theme with a light color scheme.'
      },
      {
        type: 'theme',
        id: 'firefox-alpenglow@mozilla.org',
        name: 'Firefox Alpenglow',
        description: 'Use a colorful appearance for buttons, menus, and windows.'
      }
    ],
    userThemes: [],
    groups: [],
    groupedThemes: {},
    ungroupedThemes: []
  }

  await thematic.buildThemes()
  expect(locals).toStrictEqual(expected)
})

test('startRotation', async () => {
  createCalledWith.length = 0
  syncs.auto = false
  syncs.minutes = 15
  await thematic.startRotation()
  expect(syncs.auto).toBe(true)
  expect(createCalledWith.length).toBe(1)
  expect(createCalledWith.pop()[0]).toBe('rotate')
})

test('stopRotation', async () => {
  clearCalledWith.length = 0
  await thematic.stopRotation()
  expect(syncs.auto).toBe(false)
  expect(clearCalledWith.length).toBe(1)
  expect(clearCalledWith.pop()).toBe('rotate')
})

test('rotate', async () => {
  logMessages = []

  locals = { userThemes: [] }
  await thematic.rotate()
  expect(logMessages.pop()).toBe('No user themes found!')

  locals = {
    userThemes: [
      {
        type: 'theme',
        id: 'usertheme@usertheme.org',
        name: 'user',
        description: 'A user theme.'
      }
    ]
  }
  await thematic.rotate()
  expect(logMessages.pop()).toBe('No current theme Id found!')
  expect(logMessages.length).toBe(0)

  locals = {
    userThemes: [
      {
        type: 'theme',
        id: 'usertheme@usertheme.org',
        name: 'user',
        description: 'A user theme.'
      }
    ],
    currentId: 'Missing'
  }
  enabled = []
  await thematic.rotate()
  expect(logMessages.length).toBe(0)
  expect(locals.currentId).toBe('usertheme@usertheme.org')
  expect(enabled).toStrictEqual([['usertheme@usertheme.org', true]])

  locals = {
    userThemes: [
      {
        type: 'theme',
        id: 'usertheme@usertheme.org',
        name: 'user',
        description: 'A user theme.'
      }
    ],
    currentId: 'usertheme@usertheme.org'
  }
  enabled = []
  await thematic.rotate()
  expect(logMessages.length).toBe(0)
  expect(enabled).toStrictEqual([
    ['usertheme@usertheme.org', false],
    ['usertheme@usertheme.org', true]
  ])
})

let response = ''
function receiveResponse (m) { response = m }

test('handleMessage', () => {
  thematic.handleMessage({ message: 'Start rotation' }, {}, receiveResponse)
  expect(response).toStrictEqual({ response: 'OK' })
  thematic.handleMessage({ message: 'Stop rotation' }, {}, receiveResponse)
  expect(response).toStrictEqual({ response: 'OK' })
  thematic.handleMessage({ message: 'RefreshThemes' }, {}, receiveResponse)
  expect(response).toStrictEqual({ response: 'OK' })
  thematic.handleMessage({ message: 'Bad message' }, {}, receiveResponse)
  expect(response).toStrictEqual({ response: 'Not OK' })
})

test('bad command', async () => {
  logMessages = []
  await thematic.commands('bad command')
  expect(logMessages.length).toBe(0)
})

test('rotate to next command', async () => {
  thematic.rotate = jest.fn()
  await thematic.commands('Rotate to next theme')
  expect(thematic.rotate).toHaveBeenCalled()
  expect(thematic.rotate.mock.calls.length).toBe(1)
})

test('commandsHelper delegates to commands', async () => {
  expect(commandListeners.length).toBeGreaterThan(0)
  thematic.rotate = jest.fn()
  await commandListeners[0]('Rotate to next theme')
  expect(thematic.rotate).toHaveBeenCalled()
})

test('switch to default command with no locals', async () => {
  locals = []
  logMessages = []
  await thematic.commands('Switch to default theme')
  expect(logMessages.pop()).toBe("Cannot read properties of undefined (reading 'id')")
  expect(logMessages.length).toBe(0)
})

test('switch to default command with no defaultTheme', async () => {
  locals = {
    defaultTheme: {}
  }
  logMessages = []
  await thematic.commands('Switch to default theme')
  expect(logMessages.pop()).toBe("Cannot read properties of undefined (reading 'id')")
  expect(logMessages.length).toBe(0)
})

test('switch to default command good', async () => {
  locals = {
    defaultTheme: {
      defaultTheme: {
        id: 'foo'
      }
    }
  }
  enabled = []
  thematic.stopRotation = jest.fn()
  await thematic.commands('Switch to default theme')
  expect(logMessages.length).toBe(0)
  expect(enabled).toStrictEqual([['foo', true]])
  expect(thematic.stopRotation).toHaveBeenCalled()
  expect(thematic.stopRotation.mock.calls.length).toBe(1)
})

test('getGroupedThemes, createGroup, addThemeToGroup, removeThemeFromGroup, deleteGroup', () => {
  const g = thematic.createGroup('MyGroup')
  expect(g).toStrictEqual({ name: 'MyGroup', themeIds: [] })
  let groups = [g]
  expect(thematic.addThemeToGroup(groups, 'MyGroup', 'a')).toBe(true)
  expect(thematic.addThemeToGroup(groups, 'MyGroup', 'a')).toBe(true)
  expect(groups[0].themeIds).toStrictEqual(['a'])
  expect(thematic.addThemeToGroup(groups, 'missing', 'x')).toBe(false)
  expect(thematic.removeThemeFromGroup(groups, 'MyGroup', 'a')).toBe(true)
  expect(groups[0].themeIds).toStrictEqual([])
  expect(thematic.removeThemeFromGroup(groups, 'WrongGroup', 'a')).toBe(false)
  groups = thematic.deleteGroup(groups, 'MyGroup')
  expect(groups).toStrictEqual([])

  const { grouped, ungrouped } = thematic.getGroupedThemes(
    [{ id: 't1', name: 'A' }, { id: 't2', name: 'B' }],
    [{ name: 'G', themeIds: ['t1'] }]
  )
  expect(grouped.G).toStrictEqual([{ id: 't1', name: 'A' }])
  expect(ungrouped).toStrictEqual([{ id: 't2', name: 'B' }])
})

test('saveGroups writes theme groups to storage', async () => {
  locals = {}
  await thematic.saveGroups([{ name: 'x', themeIds: ['a'] }])
  expect(locals.themeGroups).toStrictEqual([{ name: 'x', themeIds: ['a'] }])
})

test('getGroups reads themeGroups key', async () => {
  locals = { themeGroups: [{ name: 'a', themeIds: ['b'] }] }
  const origGet = global.browser.storage.local.get
  global.browser.storage.local.get = function (key) {
    if (key === 'themeGroups') {
      return Promise.resolve({ themeGroups: locals.themeGroups })
    }
    return origGet.call(this, key)
  }
  expect(await thematic.getGroups()).toStrictEqual([{ name: 'a', themeIds: ['b'] }])
  global.browser.storage.local.get = origGet
})

test('buildToolsMenu with user themes adds separator', async () => {
  const originalGetAll = global.browser.management.getAll
  const base = await originalGetAll()
  global.browser.management.getAll = function () {
    return Promise.resolve([
      ...base,
      { type: 'theme', id: 'custom@example.com', name: 'Custom', description: 'x' }
    ])
  }
  menus = []
  locals = {}
  await thematic.buildThemes()
  expect(menus.some(m => m.type === 'separator')).toBe(true)
  expect(menus.some(m => m.id === 'custom@example.com')).toBe(true)
  global.browser.management.getAll = originalGetAll
})

test('Toggle autoswitching calls stopRotation when auto is on', async () => {
  syncs.auto = true
  const spy = jest.spyOn(thematic, 'stopRotation').mockResolvedValue(undefined)
  await thematic.commands('Toggle autoswitching')
  expect(spy).toHaveBeenCalled()
  expect(syncs.auto).toBe(false)
  spy.mockRestore()
})

test('Toggle autoswitching calls startRotation when auto is off', async () => {
  syncs.auto = false
  const spy = jest.spyOn(thematic, 'startRotation').mockResolvedValue(undefined)
  await thematic.commands('Toggle autoswitching')
  expect(spy).toHaveBeenCalled()
  expect(syncs.auto).toBe(true)
  spy.mockRestore()
})

test('Toggle autoswitching logs on sync error', async () => {
  logMessages = []
  const origSyncGet = global.browser.storage.sync.get
  global.browser.storage.sync.get = function () {
    return Promise.reject(new Error('sync read failed'))
  }
  await thematic.commands('Toggle autoswitching')
  expect(logMessages.pop()).toBe('sync read failed')
  global.browser.storage.sync.get = origSyncGet
})

test('extensionInstalled notifies when a theme is installed', async () => {
  expect(managementInstalledListeners.length).toBeGreaterThan(0)
  const fn = managementInstalledListeners[0]
  const sendSpy = jest.spyOn(global.browser.runtime, 'sendMessage').mockResolvedValue(undefined)
  await fn({ type: 'theme', id: 'new@user.org' })
  expect(sendSpy).toHaveBeenCalledWith({ message: 'ThemesUpdated' })
  await new Promise(resolve => setImmediate(resolve))
  sendSpy.mockRestore()
})

test('extensionInstalled logs when sendMessage rejects', async () => {
  logMessages = []
  const orig = global.browser.runtime.sendMessage
  global.browser.runtime.sendMessage = function () {
    return Promise.reject(new Error('no receiver'))
  }
  const fn = managementInstalledListeners[0]
  await fn({ type: 'theme', id: 't@t.org' })
  await new Promise(resolve => setImmediate(resolve))
  global.browser.runtime.sendMessage = orig
  expect(logMessages.some(m => String(m).includes('Could not send message'))).toBe(true)
})

test('extensionInstalled only logs for non-theme', () => {
  logMessages = []
  const fn = managementInstalledListeners[0]
  fn({ type: 'extension', id: 'ext@id' })
  expect(logMessages[0]).toBe('Theme installed/uninstalled:')
})

test('menus onClicked enables theme and sets currentId', async () => {
  expect(menuClickListeners.length).toBeGreaterThan(0)
  enabled = []
  locals = {}
  menuClickListeners[0]({ menuItemId: 'pick@theme.org' })
  await new Promise(resolve => setImmediate(resolve))
  expect(locals.currentId).toBe('pick@theme.org')
  expect(enabled).toStrictEqual([['pick@theme.org', true]])
})

test('menus onClicked logs when storage set fails', async () => {
  logMessages = []
  const origSet = global.browser.storage.local.set
  global.browser.storage.local.set = function () {
    return Promise.reject(new Error('set failed'))
  }
  menuClickListeners[0]({ menuItemId: 'x' })
  await new Promise(resolve => setImmediate(resolve))
  global.browser.storage.local.set = origSet
  const err = logMessages.pop()
  expect(err && err.message).toBe('set failed')
})
