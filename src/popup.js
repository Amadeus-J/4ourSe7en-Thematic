// vim: ts=2 sw=2 expandtab
/* global browser */

'use strict'

function handleDragStart (e) {
  console.log('Drag started')
  e.dataTransfer.setData('text/plain', JSON.stringify({
    themeId: e.target.dataset.themeId,
    themeName: e.target.dataset.themeName
  }))
  e.dataTransfer.effectAllowed = 'move'
  e.target.classList.add('dragging')
}

function handleDragEnd (e) {
  console.log('Drag ended')
  e.target.classList.remove('dragging')
  document.querySelectorAll('.drop-target').forEach(el => {
    el.classList.remove('drag-over')
  })
}

function handleDragOver (e) {
  e.preventDefault()
  console.log('dragover fired')
  const dropTarget = e.target.closest('.drop-target')
  if (dropTarget) {
    dropTarget.classList.add('drag-over')
    e.dataTransfer.dropEffect = 'move'
  }
}

function handleDragLeave (e) {
  console.log('dragleave fired')
  const dropTarget = e.target.closest('.drop-target')
  if (dropTarget && !dropTarget.contains(e.relatedTarget)) {
    dropTarget.classList.remove('drag-over')
  }
}

function createCollapsibleSection (title, themes, isExpanded = true, groups = [], isDropTarget = false) {
  const container = document.createElement('div')
  container.className = 'collapsible-group'
  if (isDropTarget) {
    container.classList.add('drop-target')
    container.dataset.groupName = title
  }

  const header = document.createElement('div')
  header.className = 'collapsible-header'
  if (isDropTarget && title !== 'Ungrouped') {
    header.dataset.groupName = title
  }
  
  const arrow = document.createElement('span')
  arrow.className = 'collapse-arrow'
  arrow.textContent = isExpanded ? '\u25BC' : '\u25B6'

  const titleSpan = document.createElement('span')
  titleSpan.className = 'collapsible-title'
  titleSpan.textContent = title

  const countSpan = document.createElement('span')
  countSpan.className = 'collapsible-count'
  countSpan.textContent = `(${themes.length})`

  header.appendChild(arrow)
  header.appendChild(titleSpan)
  header.appendChild(countSpan)

  const content = document.createElement('div')
  content.className = 'collapsible-content'
  if (!isExpanded) {
    content.style.display = 'none'
  }

  const isDefaultThemes = title === 'Default Themes'

  for (const theme of themes) {
    const themeWrapper = document.createElement('div')
    themeWrapper.className = 'theme-wrapper'
    if (!isDefaultThemes) {
      themeWrapper.classList.add('draggable')
      themeWrapper.draggable = true
      themeWrapper.dataset.themeId = theme.id
      themeWrapper.dataset.themeName = theme.name
    }

    const themeButton = document.createElement('div')
    themeButton.setAttribute('id', theme.id)
    themeButton.setAttribute('class', 'theme-button')
    themeButton.textContent = theme.name
    themeButton.addEventListener('mouseenter', (e) => {
      browser.management.setEnabled(e.target.id, true)
    })

    themeWrapper.appendChild(themeButton)
    content.appendChild(themeWrapper)
  }

  header.addEventListener('click', () => {
    const isVisible = content.style.display !== 'none'
    content.style.display = isVisible ? 'none' : 'block'
    arrow.textContent = isVisible ? '\u25B6' : '\u25BC'
  })

  container.appendChild(header)
  container.appendChild(content)

  return container
}

function rebuildGroupedThemes (userThemes, groups) {
  const grouped = {}
  const ungrouped = []

  for (const theme of userThemes) {
    let found = false
    for (const group of groups) {
      if (group.themeIds && group.themeIds.includes(theme.id)) {
        if (!grouped[group.name]) {
          grouped[group.name] = []
        }
        grouped[group.name].push(theme)
        found = true
        break
      }
    }
    if (!found) {
      ungrouped.push(theme)
    }
  }

  return { grouped, ungrouped }
}

async function rebuildAndRefreshUI () {
  const allExtensions = await browser.management.getAll()
  const allThemes = allExtensions.filter(info => info.type === 'theme')
  const userThemes = allThemes.filter(theme => !theme.id.endsWith('mozilla.org'))
  const defaultThemes = allThemes.filter(theme => theme.id.endsWith('mozilla.org'))
  
  const stored = await browser.storage.local.get('themeGroups')
  const groups = stored.themeGroups || []
  
  const { grouped, ungrouped } = rebuildGroupedThemes(userThemes, groups)
  
  await browser.storage.local.set({
    userThemes: userThemes,
    defaultThemes: defaultThemes,
    groupedThemes: grouped,
    ungroupedThemes: ungrouped,
    groups: groups
  })
  
  await refreshUI()
}

async function refreshUI () {
  const items = await browser.storage.local.get()
  const currentDiv = document.getElementById('popup-content')

  while (currentDiv.firstChild) {
    currentDiv.removeChild(currentDiv.firstChild)
  }

  const groupedThemes = items.groupedThemes || {}
  const ungroupedThemes = items.ungroupedThemes || []
  const groups = items.groups || []

  for (const group of groups) {
    const themes = groupedThemes[group.name] || []
    currentDiv.appendChild(createCollapsibleSection(group.name, themes, true, groups, true))
  }

  if (ungroupedThemes && ungroupedThemes.length > 0) {
    if (groups.length > 0) {
      currentDiv.appendChild(document.createElement('hr'))
    }
    currentDiv.appendChild(createCollapsibleSection('Ungrouped', ungroupedThemes, true, groups, true))
  }

  if (items.defaultThemes && items.defaultThemes.length > 0) {
    currentDiv.appendChild(document.createElement('hr'))
    currentDiv.appendChild(createCollapsibleSection('Default Themes', items.defaultThemes, false))
  }

  document.querySelectorAll('.draggable').forEach(el => {
    el.addEventListener('dragstart', handleDragStart)
    el.addEventListener('dragend', handleDragEnd)
  })

  currentDiv.addEventListener('dragover', handleDragOver)
  currentDiv.addEventListener('dragleave', handleDragLeave)
  currentDiv.addEventListener('drop', handleDrop)
  
  currentDiv.querySelectorAll('.collapsible-header').forEach(header => {
    if (header.dataset.groupName) {
      header.addEventListener('contextmenu', (e) => {
        const groupName = header.dataset.groupName
        showContextMenu(e, groupName)
      })
    }
  })
}

async function addNewGroup () {
  const name = prompt('Enter group name:')
  if (!name || !name.trim()) return

  const stored = await browser.storage.local.get('themeGroups')
  const groups = stored.themeGroups || []

  if (groups.some(g => g.name === name.trim())) {
    alert('Group already exists!')
    return
  }

  groups.push({ name: name.trim(), themeIds: [] })
  await browser.storage.local.set({ themeGroups: groups })

  await rebuildAndRefreshUI()
}

async function renameGroup (oldName) {
  const newName = prompt('Enter new group name:', oldName)
  if (!newName || !newName.trim() || newName.trim() === oldName) return

  const stored = await browser.storage.local.get('themeGroups')
  const groups = stored.themeGroups || []

  if (groups.some(g => g.name === newName.trim() && g.name !== oldName)) {
    alert('Group name already exists!')
    return
  }

  for (const group of groups) {
    if (group.name === oldName) {
      group.name = newName.trim()
      break
    }
  }

  await browser.storage.local.set({ themeGroups: groups })
  await rebuildAndRefreshUI()
}

async function deleteGroup (groupName) {
  if (!confirm(`Delete group "${groupName}"? Themes will be moved to Ungrouped.`)) return

  const stored = await browser.storage.local.get('themeGroups')
  const groups = stored.themeGroups || []

  const newGroups = groups.filter(g => g.name !== groupName)
  await browser.storage.local.set({ themeGroups: newGroups })

  await rebuildAndRefreshUI()
}

async function handleDrop (e) {
  e.preventDefault()
  console.log('Drop event fired')
  const dropTarget = e.target.closest('.drop-target')
  if (!dropTarget) {
    console.log('No drop target found')
    return
  }

  console.log('Drop target:', dropTarget.dataset.groupName)
  dropTarget.classList.remove('drag-over')

  const data = JSON.parse(e.dataTransfer.getData('text/plain'))
  console.log('Dropped data:', data)
  const groupName = dropTarget.dataset.groupName
  
  const stored = await browser.storage.local.get('themeGroups')
  console.log('Current groups:', stored.themeGroups)
  const groups = stored.themeGroups || []

  for (const group of groups) {
    group.themeIds = group.themeIds.filter(id => id !== data.themeId)
  }

  for (const group of groups) {
    if (group.name === groupName) {
      if (!group.themeIds.includes(data.themeId)) {
        group.themeIds.push(data.themeId)
      }
      break
    }
  }

  console.log('Updated groups:', groups)
  await browser.storage.local.set({ themeGroups: groups })
  
  const items = await browser.storage.local.get()
  const userThemes = items.userThemes || []
  console.log('User themes:', userThemes.length)
  
  const { grouped, ungrouped } = rebuildGroupedThemes(userThemes, groups)
  console.log('Rebuilt grouped:', grouped)
  console.log('Rebuilt ungrouped:', ungrouped.length)

  await browser.storage.local.set({
    groupedThemes: grouped,
    ungroupedThemes: ungrouped,
    groups: groups
  })

  const currentDiv = document.getElementById('popup-content')
  currentDiv.innerHTML = ''
  
  for (const group of groups) {
    const themes = grouped[group.name] || []
    currentDiv.appendChild(createCollapsibleSection(group.name, themes, true, groups, true))
  }

  if (ungrouped && ungrouped.length > 0) {
    if (groups.length > 0) {
      currentDiv.appendChild(document.createElement('hr'))
    }
    currentDiv.appendChild(createCollapsibleSection('Ungrouped', ungrouped, true, groups, true))
  }

  const allExt = await browser.management.getAll()
  const allTh = allExt.filter(info => info.type === 'theme')
  const defThemes = allTh.filter(t => t.id.endsWith('mozilla.org'))
  if (defThemes.length > 0) {
    currentDiv.appendChild(document.createElement('hr'))
    currentDiv.appendChild(createCollapsibleSection('Default Themes', defThemes, false))
  }

  document.querySelectorAll('.draggable').forEach(el => {
    el.addEventListener('dragstart', handleDragStart)
    el.addEventListener('dragend', handleDragEnd)
  })

  currentDiv.addEventListener('dragover', handleDragOver)
  currentDiv.addEventListener('dragleave', handleDragLeave)
  currentDiv.addEventListener('drop', handleDrop)
  
  console.log('UI refreshed')
}

document.getElementById('add-group-btn')?.addEventListener('click', addNewGroup)

function showContextMenu (e, groupName) {
  console.log('showContextMenu called for:', groupName)
  e.preventDefault()
  
  const existingMenu = document.querySelector('.custom-context-menu')
  if (existingMenu) existingMenu.remove()

  const menu = document.createElement('div')
  menu.className = 'custom-context-menu'
  menu.style.position = 'fixed'
  menu.style.left = e.pageX + 'px'
  menu.style.top = e.pageY + 'px'
  menu.innerHTML = `
    <div class="menu-item" data-action="rename">Rename</div>
    <div class="menu-item" data-action="delete">Delete</div>
  `

  menu.querySelector('[data-action="rename"]').addEventListener('click', () => {
    menu.remove()
    renameGroup(groupName)
  })

  menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
    menu.remove()
    deleteGroup(groupName)
  })

  document.body.appendChild(menu)

  const closeMenu = (ev) => {
    if (!menu.contains(ev.target)) {
      menu.remove()
      document.removeEventListener('click', closeMenu)
    }
  }
  setTimeout(() => document.addEventListener('click', closeMenu), 0)
}

browser.storage.local.get().then(() => {
  rebuildAndRefreshUI()
})

window.addEventListener('focus', () => {
  rebuildAndRefreshUI()
})

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Popup received message:', request.message)
  if (request.message === 'ThemesUpdated') {
    rebuildAndRefreshUI()
  }
})

document.addEventListener('click', (e) => {
  const currentId = e.target.closest('.theme-button')?.id
  if (currentId) {
    console.log('Setting currentId to: ' + currentId)
    browser.storage.local.set({ currentId: currentId }).then(() => {
      browser.management.setEnabled(currentId, true)
      window.close()
    }).catch((err) => console.log(err))
  }
})