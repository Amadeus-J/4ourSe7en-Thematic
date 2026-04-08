// vim: ts=2 sw=2 expandtab
/* global browser */

'use strict'

function buildMenuItem (theme, onGroupSelect) {
  const newChoice = document.createElement('div')
  newChoice.setAttribute('id', theme.id)
  newChoice.setAttribute('class', 'theme-button')
  newChoice.textContent = theme.name
  newChoice.addEventListener('mouseenter', (e) => {
    browser.management.setEnabled(e.target.id, true)
  })
  return newChoice
}

function createCollapsibleSection (title, themes, isExpanded = true, groups = [], onGroupSelect = null) {
  const container = document.createElement('div')
  container.className = 'collapsible-group'

  const header = document.createElement('div')
  header.className = 'collapsible-header'
  
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

  const isUngrouped = title === 'Ungrouped'

  for (const theme of themes) {
    const themeWrapper = document.createElement('div')
    themeWrapper.className = 'theme-wrapper'

    const themeButton = document.createElement('div')
    themeButton.setAttribute('id', theme.id)
    themeButton.setAttribute('class', 'theme-button')
    themeButton.textContent = theme.name
    themeButton.addEventListener('mouseenter', (e) => {
      browser.management.setEnabled(e.target.id, true)
    })

    themeWrapper.appendChild(themeButton)

    if (isUngrouped && groups.length > 0 && onGroupSelect) {
      const select = document.createElement('select')
      select.className = 'group-select'
      select.innerHTML = '<option value="">Add to group...</option>'
      
      for (const group of groups) {
        const option = document.createElement('option')
        option.value = group.name
        option.textContent = group.name
        select.appendChild(option)
      }

      select.addEventListener('change', (e) => {
        if (e.target.value) {
          onGroupSelect(theme.id, e.target.value)
          e.target.value = ''
        }
      })

      themeWrapper.appendChild(select)
    }

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

async function addThemeToGroupFromPopup (themeId, groupName) {
  const stored = await browser.storage.local.get('themeGroups')
  const groups = stored.themeGroups || []

  for (const group of groups) {
    if (group.name === groupName) {
      if (!group.themeIds.includes(themeId)) {
        group.themeIds.push(themeId)
      }
      break
    }
  }

  await browser.storage.local.set({ themeGroups: groups })
  
  const items = await browser.storage.local.get()
  const userThemes = items.userThemes || []
  const allGroups = items.groups || []
  const { grouped, ungrouped } = getGroupedThemes(userThemes, allGroups)

  await browser.storage.local.set({
    groupedThemes: grouped,
    ungroupedThemes: ungrouped
  })
}

browser.storage.local.get().then((items) => {
  const currentDiv = document.getElementById('popup-content')
  
  currentDiv.addEventListener('mouseleave', (e) => {
    browser.management.setEnabled(items.currentId, true)
  })

  while (currentDiv.firstChild) {
    currentDiv.removeChild(currentDiv.firstChild)
  }

  const groupedThemes = items.groupedThemes || {}
  const ungroupedThemes = items.ungroupedThemes || []
  const groups = items.groups || []

  let hasGroups = false
  for (const groupName of Object.keys(groupedThemes)) {
    const themes = groupedThemes[groupName]
    if (themes && themes.length > 0) {
      currentDiv.appendChild(createCollapsibleSection(groupName, themes, true, groups, addThemeToGroupFromPopup))
      hasGroups = true
    }
  }

  if (ungroupedThemes && ungroupedThemes.length > 0) {
    if (hasGroups) {
      currentDiv.appendChild(document.createElement('hr'))
    }
    currentDiv.appendChild(createCollapsibleSection('Ungrouped', ungroupedThemes, true, groups, addThemeToGroupFromPopup))
  }

  if (items.defaultThemes && items.defaultThemes.length > 0) {
    currentDiv.appendChild(document.createElement('hr'))
    currentDiv.appendChild(createCollapsibleSection('Default Themes', items.defaultThemes, false))
  }
})

document.addEventListener('click', (e) => {
  const currentId = e.target.id
  if (currentId && !e.target.classList.contains('group-select')) {
    console.log('Setting currentId to: ' + currentId)
    browser.storage.local.set({ currentId: currentId }).then(() => {
      browser.management.setEnabled(currentId, true)
      window.close()
    }).catch((err) => console.log(err))
  }
})