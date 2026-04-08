global.browser = {
  alarms: {
    clear: function () {},
    create: function () {},
    onAlarm: { addListener: function () {} }
  },
  storage: {
    local: { get: function () { return Promise.resolve({}) }, set: function () { return Promise.resolve() } },
    sync: { get: function () { return Promise.resolve({}) }, set: function () { return Promise.resolve() } }
  },
  management: {
    getAll: function () { return Promise.resolve([]) },
    setEnabled: function () { return Promise.resolve() }
  },
  runtime: {
    getBrowserInfo: function () { return Promise.resolve({ name: 'Firefox' }) },
    onMessage: { addListener: function () {} },
    sendMessage: function () { return Promise.resolve() }
  },
  commands: { onCommand: { addListener: function () {} } },
  menus: {
    create: function () {},
    removeAll: function () {},
    onClicked: { addListener: function () {} }
  },
  i18n: { getMessage: function () { return '' } }
}