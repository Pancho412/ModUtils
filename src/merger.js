// Mod Merger Script
// Combines 2 mods into 1 single mod
// Extracts includeTag from mod2's theme.xml and adds it to mod1's theme.xml

// Default includes that come with the base theme.xml - these should be filtered out
const DEFAULT_THEME_INCLUDES = [
  "fonts.xml",
  "cursors.xml",
  "gfx.xml",
  "gfx_ui.xml",
  "init.xml",
  "ui/main.xml",
  "ui/battle.xml",
  "ui/contest.xml",
  "ui/party.xml",
  "ui/inventory.xml",
  "ui/chat.xml",
  "ui/monster-dex.xml",
  "ui/monster-frame.xml",
  "ui/customization.xml",
  "ui/settings.xml",
  "ui/guild.xml",
  "ui/matchmaking.xml",
  "ui/social.xml",
  "ui/instance.xml",
  "ui/trade.xml",
  "ui/shop.xml",
  "ui/link.xml",
  "ui/misc.xml",
  "ui/advanced-search.xml",
  "ui/broker.xml",
  "ui/pc.xml",
  "ui/incubator.xml",
  "ui/staff.xml",
  "main-widgets.xml"
]

const mod1Data = {
  zip: null,
  info: null,
  files: {},
  icon: null,
  folderName: null,
  includeTags: [],
  themeXmlPath: null,
  themeXmlContent: null
}

const mod2Data = {
  zip: null,
  info: null,
  files: {},
  icon: null,
  folderName: null,
  includeTags: [],
  themeXmlPath: null,
  themeXmlContent: null
}

// DOM elements
const modUpload1 = document.getElementById("modUpload1")
const modUpload2 = document.getElementById("modUpload2")
const modInput1 = document.getElementById("modInput1")
const modInput2 = document.getElementById("modInput2")
const modPreview1 = document.getElementById("modPreview1")
const modPreview2 = document.getElementById("modPreview2")
const modRemove1 = document.getElementById("modRemove1")
const modRemove2 = document.getElementById("modRemove2")
const mergeBtn = document.getElementById("mergeBtn")
const mergeBtnText = document.getElementById("mergeBtnText")
const logEl = document.getElementById("log")
const logButton = document.getElementById("log_button")

// Setup event listeners
function setupModSlot(uploadArea, input, previewEl, removeBtn, modData, slotNum) {
  uploadArea.addEventListener("click", () => input.click())

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault()
    uploadArea.classList.add("drag-over")
  })

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("drag-over")
  })

  uploadArea.addEventListener("drop", async (e) => {
    e.preventDefault()
    uploadArea.classList.remove("drag-over")
    const files = e.dataTransfer.files
    if (files.length > 0 && (files[0].name.endsWith(".zip") || files[0].name.endsWith(".mod"))) {
      await loadMod(files[0], modData, slotNum)
    }
  })

  input.addEventListener("change", async (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.name.endsWith(".zip") || file.name.endsWith(".mod")) {
        await loadMod(file, modData, slotNum)
      }
    }
  })

  removeBtn.addEventListener("click", () => {
    clearMod(modData, slotNum)
  })
}

setupModSlot(modUpload1, modInput1, modPreview1, modRemove1, mod1Data, 1)
setupModSlot(modUpload2, modInput2, modPreview2, modRemove2, mod2Data, 2)

// Load mod from zip file
async function loadMod(file, modData, slotNum) {
  try {
    const JSZip = window.JSZip; // Declare JSZip variable
    const zip = await JSZip.loadAsync(file)
    modData.zip = zip

    // Find and parse info.xml
    const infoFile = zip.file("info.xml")
    if (!infoFile) {
      alert("Invalid mod: info.xml not found")
      return
    }

    const infoContent = await infoFile.async("string")
    const parser = new DOMParser()
    const infoXml = parser.parseFromString(infoContent, "text/xml")
    const resource = infoXml.querySelector("resource")

    if (!resource) {
      alert("Invalid mod: resource element not found in info.xml")
      return
    }

    modData.info = {
      name: resource.getAttribute("name") || "Unknown",
      description: resource.getAttribute("description") || "",
      author: resource.getAttribute("author") || "Unknown",
      version: resource.getAttribute("version") || "1.0"
    }

    // Find overlay path
    const overlay = infoXml.querySelector("overlay")
    if (!overlay) {
      alert("Invalid mod: no overlay found")
      return
    }

    const overlayPath = overlay.getAttribute("path")
    if (!overlayPath || !overlayPath.includes("data/themes/")) {
      alert("Invalid mod: overlay path must be data/themes/")
      return
    }

    // Load icon
    let iconFile = zip.file("icon.png") || zip.file("icon.jpg")
    if (iconFile) {
      const iconBlob = await iconFile.async("blob")
      modData.icon = URL.createObjectURL(iconBlob)
    } else {
      modData.icon = null
    }

    // Analyze mod files
    const path_overlay = "data/themes/"
    const files = Object.keys(zip.files).filter(f => !zip.files[f].dir)
    
    modData.files = {}
    modData.includeTags = []
    modData.folderName = null

    for (const filePath of files) {
      if (filePath === "info.xml" || filePath.startsWith("icon.")) continue

      // Get path relative to themes folder
      let relativePath = filePath
      if (filePath.includes(`${path_overlay}default/`)) {
        relativePath = filePath.replace(`${path_overlay}default/`, "")
      } else if (filePath.includes(`${path_overlay}android/`)) {
        relativePath = filePath.replace(`${path_overlay}android/`, "")
      }

      if (!relativePath || relativePath === filePath) continue

      const fileName = relativePath.split("/").pop()
      const fileNameWithoutExt = fileName.replace(/\.(xml|png|jpg|ttf)$/, "")

      // Determine folder name from first file
      if (!modData.folderName && relativePath.includes("/")) {
        modData.folderName = relativePath.split("/")[0]
      }

      // Store file info
      modData.files[fileName] = {
        path: relativePath,
        fullPath: filePath,
        isXml: fileName.endsWith(".xml")
      }

      // Store theme.xml path and content
      if (fileNameWithoutExt === "theme") {
        modData.themeXmlPath = relativePath
      }
    }

    // Parse theme.xml to extract include tags and check for missing defaults
    const themeXmlFile = Object.entries(modData.files).find(([name]) => name === "theme.xml")
    if (themeXmlFile) {
      const fullPath = themeXmlFile[1].fullPath
      const file = zip.file(fullPath)
      if (file) {
        const themeContent = await file.async("string")
        modData.themeXmlContent = themeContent
        
        // Extract all include tags from theme.xml
        const includeMatches = themeContent.match(/<include\s+filename="[^"]+"\s*\/>/g) || []
        
        // Get list of current includes in the theme.xml
        const currentIncludes = includeMatches.map(tag => {
          const match = tag.match(/filename="([^"]+)"/)
          return match ? match[1] : null
        }).filter(Boolean)
        
        // Check for missing default includes
        const missingIncludes = DEFAULT_THEME_INCLUDES.filter(inc => !currentIncludes.includes(inc))
        modData.missingIncludes = missingIncludes
        
        if (missingIncludes.length > 0) {
          modData.isOutdated = true
          console.log(`[v0] Mod ${slotNum} is outdated. Missing includes:`, missingIncludes)
        } else {
          modData.isOutdated = false
        }
        
        // Filter out default includes - only keep mod-specific includes
        modData.includeTags = includeMatches.filter(tag => {
          const filenameMatch = tag.match(/filename="([^"]+)"/)
          if (filenameMatch) {
            const filename = filenameMatch[1]
            return !DEFAULT_THEME_INCLUDES.includes(filename)
          }
          return true
        })
      }
    }

    // Update UI
    updateModPreview(modData, slotNum)
    updateMergePreview()
    console.log(modData)

  } catch (error) {
    console.error("Error loading mod:", error)
    alert("Error loading mod: " + error.message)
  }
}

function clearMod(modData, slotNum) {
  modData.zip = null
  modData.info = null
  modData.files = {}
  modData.icon = null
  modData.folderName = null
  modData.includeTags = []

  const uploadArea = document.getElementById(`modUpload${slotNum}`)
  const preview = document.getElementById(`modPreview${slotNum}`)

  uploadArea.style.display = "flex"
  preview.style.display = "none"

  updateMergePreview()
}

function updateModPreview(modData, slotNum) {
  const uploadArea = document.getElementById(`modUpload${slotNum}`)
  const preview = document.getElementById(`modPreview${slotNum}`)
  const iconEl = document.getElementById(`modIcon${slotNum}`)
  const nameEl = document.getElementById(`modName${slotNum}`)
  const authorEl = document.getElementById(`modAuthor${slotNum}`)
  const filesEl = document.getElementById(`modFiles${slotNum}`)

  uploadArea.style.display = "none"
  preview.style.display = "flex"

  if (modData.icon) {
    iconEl.src = modData.icon
  } else {
    iconEl.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect fill='%23555' width='60' height='60'/%3E%3Ctext x='50%25' y='50%25' fill='%23888' text-anchor='middle' dy='.3em'%3EMod%3C/text%3E%3C/svg%3E"
  }

  nameEl.textContent = modData.info.name
  authorEl.textContent = `By ${modData.info.author}`
  
  // Show simple status, with outdated warning if needed
  if (modData.isOutdated && modData.missingIncludes.length > 0) {
    filesEl.textContent = "Outdated (will be updated automatically)"
    preview.classList.add("outdated")
  } else {
    filesEl.textContent = "Ready to merge"
    preview.classList.remove("outdated")
  }
}

function updateMergePreview() {
  const hasBothMods = mod1Data.zip && mod2Data.zip

  if (!hasBothMods) {
    mergeBtn.disabled = true
    mergeBtnText.textContent = "Upload both mods to merge"
    return
  }

  mergeBtn.disabled = false
  mergeBtnText.textContent = "Merge Mods"

}

// Merge button click handler
mergeBtn.addEventListener("click", async () => {
  if (!mod1Data.zip || !mod2Data.zip) return

  mergeBtn.disabled = true
  mergeBtnText.innerHTML = '<span class="spinner"></span>Merging...'
  logEl.classList.add("show")
  logEl.innerHTML = ""
  logButton.style = "background-color: transparent;"

  try {
    await mergeMods()
  } catch (error) {
    addLog(`Error: ${error.message}`, "error")
  }

  mergeBtn.disabled = false
  mergeBtnText.textContent = "Merge Mods"
})

function addLog(message, type = "info") {
  const item = document.createElement("div")
  item.className = `log-item ${type}`
  item.textContent = message
  logEl.appendChild(item)
  logEl.scrollTop = logEl.scrollHeight
}

async function mergeMods() {
  addLog("Starting mod merge...", "info")

  const JSZip = window.JSZip
  const mergedZip = new JSZip()
  const targetFolder = mod1Data.folderName
  const path_overlay = "data/themes/default/"

  // Copy all mod1 files (except theme.xml which will be modified)
  addLog("Copying files from primary mod...", "info")
  for (const [fileName, fileInfo] of Object.entries(mod1Data.files)) {
    if (fileName === "theme.xml") continue // Skip, will add modified version later
    
    const file = mod1Data.zip.file(fileInfo.fullPath)
    if (file) {
      const content = await file.async("blob")
      const targetPath = path_overlay + fileInfo.path
      mergedZip.file(targetPath, content)
      addLog(`+ ${fileInfo.path}`, "success")
    }
  }

  // Copy mod2 files (except theme.xml and info.xml)
  addLog("Copying files from secondary mod...", "info")
  for (const [fileName, fileInfo] of Object.entries(mod2Data.files)) {
    if (fileName === "theme.xml") continue // Skip theme.xml from mod2
    
    const file = mod2Data.zip.file(fileInfo.fullPath)
    if (file) {
      const content = await file.async("blob")
      
      // Keep original path structure (mod2's folder remains)
      const targetPath = path_overlay + fileInfo.path
      mergedZip.file(targetPath, content)
      addLog(`+ ${fileInfo.path}`, "success")
    }
  }

  // Merge theme.xml: Add missing default includes and mod2's include tags
  addLog("Merging theme.xml...", "info")
  
  let mergedThemeXml = mod1Data.themeXmlContent
  
  // First, add any missing default includes to mod1's theme.xml in the correct position
  if (mod1Data.missingIncludes && mod1Data.missingIncludes.length > 0) {
    addLog(`Mod 1 is outdated. Adding ${mod1Data.missingIncludes.length} missing default includes...`, "warning")
    
    for (const missingInclude of mod1Data.missingIncludes) {
      // Find the position where this include should be inserted based on DEFAULT_THEME_INCLUDES order
      const missingIndex = DEFAULT_THEME_INCLUDES.indexOf(missingInclude)
      const includeTag = `<include filename="${missingInclude}"/>`
      
      // Find the next include that exists after this one in the default order
      let insertAfterInclude = null
      for (let i = missingIndex - 1; i >= 0; i--) {
        const prevInclude = DEFAULT_THEME_INCLUDES[i]
        if (mergedThemeXml.includes(`filename="${prevInclude}"`)) {
          insertAfterInclude = prevInclude
          break
        }
      }
      
      if (insertAfterInclude) {
        // Insert after the previous include
        const prevIncludePattern = new RegExp(`(<include\\s+filename="${insertAfterInclude.replace("/", "\\/")}"\\/?>)`, "g")
        mergedThemeXml = mergedThemeXml.replace(prevIncludePattern, `$1\n\t${includeTag}`)
      } else {
        // Insert before </themes> if no reference point found
        const closingTag = "</themes>"
        const insertPosition = mergedThemeXml.lastIndexOf(closingTag)
        if (insertPosition !== -1) {
          mergedThemeXml = mergedThemeXml.slice(0, insertPosition) + `\t${includeTag}\n` + mergedThemeXml.slice(insertPosition)
        }
      }
      
      addLog(`+ Added missing default: ${includeTag}`, "warning")
    }
  }
  
  // Then add mod2's include tags before </themes>
  const mod2IncludeTags = mod2Data.includeTags
  
  if (mod2IncludeTags.length > 0) {
    // Find the closing </themes> tag and insert mod2's includes before it
    const closingTag = "</themes>"
    const insertPosition = mergedThemeXml.lastIndexOf(closingTag)
    
    if (insertPosition !== -1) {
      const includesText = "\n\t" + mod2IncludeTags.join("\n\t") + "\n"
      mergedThemeXml = mergedThemeXml.slice(0, insertPosition) + includesText + mergedThemeXml.slice(insertPosition)
      
      mod2IncludeTags.forEach(tag => {
        addLog(`+ Added to theme.xml: ${tag}`, "success")
      })
    }
  }
  
  // Add merged theme.xml
  const themeXmlPath = path_overlay + mod1Data.themeXmlPath
  mergedZip.file(themeXmlPath, mergedThemeXml)
  addLog(`+ ${mod1Data.themeXmlPath} (merged)`, "success")

  // Copy icon from mod1
  const iconFile = mod1Data.zip.file("icon.png") || mod1Data.zip.file("icon.jpg")
  if (iconFile) {
    const iconContent = await iconFile.async("blob")
    const iconName = mod1Data.zip.file("icon.png") ? "icon.png" : "icon.jpg"
    mergedZip.file(iconName, iconContent)
    addLog(`+ ${iconName}`, "success")
  }

  // Generate info.xml using mod1's info
  addLog("Generating info.xml...", "info")
  
  const infoXml = `<?xml version="1.0" encoding="UTF-8"?>

<resource name="${mod1Data.info.name}" version="${mod1Data.info.version}" description="${mod1Data.info.description}" author="${mod1Data.info.author}">
    <overlays>
        <overlay path="data/themes/"/>
    </overlays>
</resource>
`
  mergedZip.file("info.xml", infoXml)
  addLog("+ info.xml", "success")

  // Generate merged mod zip
  addLog("Generating merged mod file...", "info")
  const mergedContent = await mergedZip.generateAsync({ type: "blob" })

  // Download
  const downloadLink = document.createElement("a")
  downloadLink.href = URL.createObjectURL(mergedContent)
  downloadLink.download = `${mod1Data.info.name.replace(/\s+/g, "_")}_merged.zip`
  downloadLink.click()

  addLog("Merge complete! Download started.", "success")
}
