/* global browser */

'use strict'

function saveOptions (e) {
  e.preventDefault()
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

async function loadGroups () {
  const stored = await browser.storage.local.get('themeGroups')
  const groups = stored.themeGroups || []
  const themesData = await browser.storage.local.get('userThemes')
  const userThemes = themesData.userThemes || []
  
  renderGroups(groups, userThemes)
}

function renderGroups (groups, userThemes) {
  const container = document.getElementById('groups-container')
  container.innerHTML = ''

  for (const group of groups) {
    const groupDiv = document.createElement('div')
    groupDiv.className = 'group-item'
    groupDiv.innerHTML = `
      <strong>${escapeHtml(group.name)}</strong>
      <button class="delete-group-btn" data-group="${escapeHtml(group.name)}">Delete</button>
    `

    const themeList = document.createElement('div')
    themeList.className = 'theme-list'

    for (const theme of userThemes) {
      const isInGroup = group.themeIds && group.themeIds.includes(theme.id)
      const themeItem = document.createElement('div')
      themeItem.className = 'theme-item'
      themeItem.innerHTML = `
        <input type="checkbox" class="group-theme-checkbox" 
          data-group="${escapeHtml(group.name)}" 
          data-theme="${escapeHtml(theme.id)}"
          ${isInGroup ? 'checked' : ''}>
        <span>${escapeHtml(theme.name)}</span>
      `
      themeList.appendChild(themeItem)
    }

    groupDiv.appendChild(themeList)
    container.appendChild(groupDiv)
  }

  if (groups.length === 0) {
    container.innerHTML = '<p>No groups yet. Add one above.</p>'
  }
}

function escapeHtml (str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

async function addGroup () {
  const input = document.getElementById('new-group-name')
  const name = input.value.trim()
  if (!name) return

  const stored = await browser.storage.local.get('themeGroups')
  const groups = stored.themeGroups || []

  if (groups.some(g => g.name === name)) {
    alert('Group already exists!')
    return
  }

  groups.push({ name, themeIds: [] })
  await browser.storage.local.set({ themeGroups: groups })
  
  input.value = ''
  loadGroups()
  browser.runtime.sendMessage({ message: 'RefreshThemes' })
}

async function deleteGroup (groupName) {
  const stored = await browser.storage.local.get('themeGroups')
  const groups = stored.themeGroups || []
  const filtered = groups.filter(g => g.name !== groupName)
  await browser.storage.local.set({ themeGroups: filtered })
  
  loadGroups()
  browser.runtime.sendMessage({ message: 'RefreshThemes' })
}

async function updateGroupTheme (groupName, themeId, isChecked) {
  const stored = await browser.storage.local.get('themeGroups')
  const groups = stored.themeGroups || []

  for (const group of groups) {
    if (group.name === groupName) {
      if (isChecked) {
        if (!group.themeIds.includes(themeId)) {
          group.themeIds.push(themeId)
        }
      } else {
        group.themeIds = group.themeIds.filter(id => id !== themeId)
      }
      break
    }
  }

  await browser.storage.local.set({ themeGroups: groups })
  browser.runtime.sendMessage({ message: 'RefreshThemes' })
}

document.addEventListener('DOMContentLoaded', () => {
  loadOptions()
  localizeHtmlPage()
  loadGroups()

  document.querySelector('form').addEventListener('submit', saveOptions)

  document.getElementById('add-group-btn').addEventListener('click', addGroup)

  document.getElementById('groups-container').addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-group-btn')) {
      const groupName = e.target.dataset.group
      if (confirm(`Delete group "${groupName}"?`)) {
        deleteGroup(groupName)
      }
    }
  })

  document.getElementById('groups-container').addEventListener('change', (e) => {
    if (e.target.classList.contains('group-theme-checkbox')) {
      const groupName = e.target.dataset.group
      const themeId = e.target.dataset.theme
      updateGroupTheme(groupName, themeId, e.target.checked)
    }
  })
})

browser.runtime.onMessage.addListener((request) => {
  if (request.message === 'RefreshThemes') {
    loadGroups()
  }
})