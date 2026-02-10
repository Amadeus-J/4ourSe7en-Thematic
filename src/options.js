/* global browser */
// vim: ts=2 sw=2 expandtab

'use strict'

function saveOptions (e) {
  e.preventDefault()
  // You MUST have 'const' here for each variable
  const auto = document.getElementById('auto')
  const minutes = document.getElementById('minutes')
  const random = document.getElementById('random')

  browser.storage.sync.set({
    auto: auto.checked,
    minutes: parseInt(minutes.value),
    random: random.checked
  })
}

function loadOptions () {
  console.log('loadOptions')
  browser.storage.sync.get().then((prefs) => {
    document.getElementById('auto').checked =
      prefs.auto === undefined ? false : prefs.auto
    document.getElementById('minutes').value =
      prefs.minutes === undefined ? 30 : prefs.minutes
    document.getElementById('random').checked =
      prefs.random === undefined ? false : prefs.random
  }).catch(console.log)
}

function localizeHtmlPage () {
  const collection = document.getElementsByClassName('i18n')
  for (let i = 0; i < collection.length; i++) {
    const obj = collection[i]
    obj.textContent = browser.i18n.getMessage(obj.id.toString())
  }
}

document.addEventListener('DOMContentLoaded', loadOptions)
document.addEventListener('DOMContentLoaded', localizeHtmlPage)
document.querySelector('form').addEventListener('submit', saveOptions)
