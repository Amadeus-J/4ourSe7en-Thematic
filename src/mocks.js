'use strict'
// vim: ts=2 sw=2 expandtab

/* eslint-disable dot-notation */
global['browser'] = {
/* eslint-enable dot-notation */
  alarms: { clear: function () {}, onAlarm: { addListener: function () {} } },
  storage: { sync: { get: function () { return Promise.resolve({}) }, set: function () { return Promise.resolve() } } },
  runtime: { onMessage: { addListener: function () {} }, sendMessage: function () { return Promise.resolve() } },
  commands: { onCommand: { addListener: function () {} } },
  management: { getAll: function () { return Promise.resolve([]) }, setEnabled: function () {} },
  menus: { create: function () {}, removeAll: function () { return Promise.resolve() }, onClicked: { addListener: function () {} } },
  i18n: { getMessage: function () { return '' } }
}
