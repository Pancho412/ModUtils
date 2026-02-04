// Import JSZip library and html2canvas
const JSZip = window.JSZip

const zip = new JSZip()
let zip_file
let themes
let uploadedFile = null

const modQueue = new Set()

// Modifications that the mod does:
//      name:       the mod name
//      includeTag: if add a inclued to the theme.xml (if = "None" then doesn't add any include)
//      folderName: the name of the folder that contains the mod assets
//      files:      the files that the mod add (if = "None" then doesn't add any file)
//          "filename" : "path on the page"
//      mofify:     the files that the mod modify on the mod (if = "None" then doesn't modify any file) (the modify rule for color mod is especific, normal mods would replace the file on the theme)
//          "filename" : "path from theme.xml (if = "" then is on the same level as theme.xml)"
const MOD_CONFIGS = {
  fancy: {
    name: "Better water levels (fancy)",
    includeTag: '<include filename="fancy/drops.xml"/>',
    folderName: "fancy",
    files: {
      "water-levels.png": "fancy/water-levels.png",
      "drops.xml": "fancy/drops.xml",
    },
    modify: "None",
  },

  numbers: {
    name: "Better water levels (Number)",
    includeTag: '<include filename="numbers/drops.xml"/>',
    folderName: "numbers",
    files: {
      "water-levels-number.png": "numbers/water-levels-number.png",
      "drops.xml": "numbers/drops.xml",
    },
    modify: "None",
  },

  // configuration especific (evaluate to change for only "color mod compatible")
  colormod: {
    name: "Color Mod",
    includeTag: "<!--color mod applied-->",
    folderName: "",
    files: {},
    modify: {
      "fonts.xml": "",
    },
  },
}

// Default theme files info. to compare
const DEFAULT_THEME = {
  xmls: [
    "theme",
    "twl-themer-load",
    "main-widget",
    "init",
    "gfx_ui",
    "gfx",
    "fonts",
    "cursors",
    "ui/advanced-search",
    "ui/battle",
    "ui/broker",
    "ui/chat",
    "ui/contest",
    "ui/customization",
    "ui/guild",
    "ui/incubator",
    "ui/instance",
    "ui/inventory",
    "ui/link",
    "ui/main",
    "ui/matchmaking",
    "ui/misc",
    "ui/monster-dex",
    "ui/monster-frame",
    "ui/party",
    "ui/pc",
    "ui/setting",
    "ui/shop",
    "ui/staff",
    "ui/trade",
  ],
  folders: ["ui", "textures", "res", "res/fonts", "res/textures"],
  pngs: [
    "res/aggro",
    "res/battle-hud",
    "res/bg",
    "res/breedwindow",
    "res/caught-window",
    "res/contestgui",
    "res/cursor",
    "res/effectivity_buttons_en",
    "res/effectivity_buttons_es",
    "res/effectivity_buttons_fr",
    "res/effectivity_buttons_zh",
    "res/gameshop_de",
    "res/gameshop_en",
    "res/gameshop_es",
    "res/gameshop_fr",
    "res/gameshop_it",
    "res/gameshop_ja",
    "res/gameshop_pt",
    "res/iconreel",
    "res/main-hud",
    "res/MainTCTexture",
    "res/monster-info",
    "res/pc-slots",
    "res/pc-window",
    "res/pokemmo_ui",
    "res/preview-field",
    "res/text-bubble",
    "res/user-interface",
    "res/water-levels",
    "res/textures/disconected",
    "res/textures/icon_set",
    "textures/icon_set",
  ],
  fonts: [
    "res/fonts/battle.ttf",
    "res/fonts/DejaVuLGCSans.tff",
    "res/fonts/NotoSans-Bold.tff",
    "res/fonts/NotoSansCJK-Bold.ttc",
    "res/fonts/NotoSansCJK-Medium.ttc",
    "res/fonts/NotoSans-Medium.tff",
    "res/fonts/NotoSans-SemiCondensedBlack.tff",
  ],
}

const uploadArea = document.getElementById("uploadArea")
const fileInput = document.getElementById("fileInput")
const fileInfo = document.getElementById("fileInfo")
const fileName = document.getElementById("fileName")
const fileDesc = document.getElementById("fileDesc")
const fileIcon = document.getElementById("fileIcon")
const processBtn = document.getElementById("processBtn")
const btnText = document.getElementById("btnText")
const logDiv = document.getElementById("log")
const logButton = document.getElementById("log_button")

const customModUploadCard = document.getElementById("customModUploadCard")
const customModInput = document.getElementById("customModInput")
const customModsContainer = customModUploadCard.parentElement
const cancelFileBtn = document.getElementById("cancelFileBtn")

// Event listeners
uploadArea.addEventListener("click", () => fileInput.click())
fileInput.addEventListener("change", handleFileSelect)
processBtn.addEventListener("click", processZip)
cancelFileBtn.addEventListener("click", cancelFileSelection)

// Cancel file selection and reset UI
function cancelFileSelection() {
  uploadedFile = null
  zip_file = null
  themes = null
  
  // Reset UI
  fileInfo.classList.remove("show")
  processBtn.classList.remove("show")
  uploadArea.style.display = ""
  logDiv.innerHTML = ""
  logDiv.classList.remove("show")
  logButton.style.display = "none"
  btnText.textContent = "No theme detected"
  processBtn.disabled = true
  fileInput.value = ""
}

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
  if (files.length > 0) {
    const file = files[0]
    if (file.name.endsWith(".zip") || file.name.endsWith(".mod")) {
      uploadedFile = file
      btnText.innerHTML = '<span class="spinner"></span>Processing...'
      logDiv.innerHTML = ""
      logDiv.classList.add("show")
      logButton.style = "background-color: transparent;"
      readfile()
    } else {
      addLog("Please upload a .zip or .mod file", "error")
    }
  }
})

customModUploadCard.addEventListener("click", () => customModInput.click())
customModInput.addEventListener("change", handleCustomModUpload)

customModUploadCard.addEventListener("dragover", (e) => {
  e.preventDefault()
  customModUploadCard.style.backgroundColor = "#2a2a2a"
})

customModUploadCard.addEventListener("dragleave", () => {
  customModUploadCard.style.backgroundColor = ""
})

// read the dragged or uploaded file to see if it's a valid theme
async function readfile() {
  try {
    addLog("Loading theme...", "info")
    zip_file = await JSZip.loadAsync(uploadedFile)

    addLog("Searching info.xml...", "info")
    const infoXmlFile = zip_file.file("info.xml")

    if (!infoXmlFile) {
      // folder on folder issue
      throw new Error("Theme doesn't have info.xml")
    }

    const infoXmlContent = await infoXmlFile.async("string")
    const parser = new DOMParser()
    const infoXmlDoc = parser.parseFromString(infoXmlContent, "text/xml")

    const resourceElement = infoXmlDoc.querySelector("resource")
    if (!resourceElement) {
      addLog("❌ Error: <resource> element not found in info.xml", "error")
      return
    }

    const modName = resourceElement.getAttribute("name") || "Unknown Mod"
    const modDescription = resourceElement.getAttribute("description") || "No description"
    const modAuthor = resourceElement.getAttribute("author") || "Unknown Author"

    // Extract icon
    let iconUrl = null
    const iconPng = zip_file.file("icon.png")
    const iconJpg = zip_file.file("icon.jpg")

    if (iconPng) {
      const iconBlob = await iconPng.async("blob")
      iconUrl = URL.createObjectURL(iconBlob)
    } else if (iconJpg) {
      const iconBlob = await iconJpg.async("blob")
      iconUrl = URL.createObjectURL(iconBlob)
    }

    // for now only PC themes
    themes = infoXmlDoc.querySelectorAll('theme[is_mobile="false"]')
    addLog(`${themes.length} themes detected`, "success")

    if (themes.length === 0) {
      // no PC themes detected or it's a overlay mod
      throw new Error("No themes detected")
    }

    processBtn.disabled = false
    btnText.innerHTML = "Inject Mod"

    showFileInfo(modName,modDescription,modAuthor,iconUrl)
  } catch (error) {
    // throws or another error that i didn't catch
    addLog(`❌ Error: ${error.message}`, "error")
    console.error(error)
    btnText.textContent = "Error in file"
    processBtn.disabled = true
  }
}

// when the file to drop is selected
async function handleFileSelect(e) {
  btnText.textContent = "Inject Mod"
  const file = e.target.files[0]
  if (file && (file.name.endsWith(".zip") || file.name.endsWith(".mod"))) {
    uploadedFile = file
  } else {
    // not .zip or .mod
    addLog("Please upload a .zip or .mod file", "error")
  }

  if (!uploadedFile) return

  btnText.innerHTML = '<span class="spinner"></span>Processing...'
  logDiv.innerHTML = ""
  logDiv.classList.add("show")
  logButton.style = "background-color: transparent;"

  readfile()
}

// show file uploaded
function showFileInfo(name,desc,author,icon) {
  fileName.textContent = `${name}`
  fileDesc.innerHTML = `${desc} [By ${author}]`
  fileIcon.src = `${icon}`
  fileInfo.classList.add("show")
  processBtn.classList.add("show")
  uploadArea.style = "display : none;"
}

// show log message
function addLog(message, type = "info") {
  logDiv.classList.add("show")
  logButton.style = "background-color: transparent;"
  const logItem = document.createElement("div")
  logItem.className = `log-item ${type}`
  logItem.textContent = `${message}`
  logDiv.appendChild(logItem)
  logDiv.scrollTop = logDiv.scrollHeight
}

// process the theme to inject mods
async function processZip() {
  // case when no mod on queue (just in case even if the button is disabled when there is no mod on queue)
  if (modQueue.size === 0) {
    addLog("No mods in queue. Please add at least one mod.", "warning")
    return
  }

  try {
    btnText.innerHTML = '<span class="spinner"></span>Procesando...'
    processBtn.disabled = true

    // for each mod in queue
    for (const modId of modQueue) {
      const modConfig = MOD_CONFIGS[modId]
      addLog(`\n--- Processing ${modConfig.name} ---`, "info")

      const modFiles = modConfig._filesData || {}

      if (!modConfig._filesData) {
        // Load from paths for built-in mods
        for (const [fileName, filePath] of Object.entries(modConfig.files)) {
          const response = await fetch(filePath)
          if (fileName.endsWith(".png") || fileName.endsWith(".jpg")) {
            modFiles[fileName] = await response.blob()
          } else {
            modFiles[fileName] = await response.text()
          }
        }
      }

      // Process each theme
      for (let i = 0; i < themes.length; i++) {
        const theme = themes[i]
        let themePath = theme.getAttribute("path") || ""
        if(!themePath.endsWith("/")){
          themePath += "/"
          addLog(`⚠ theme path doesn't contain / at the end, fixing...`, "warning")
        }
        const themeName = theme.getAttribute("name")

        const themeXmlPath = themePath + "theme.xml"
        const themeXmlFile = zip_file.file(themeXmlPath)

        if (!themeXmlFile) {
          // theme.xml not found, probably a wrong path
          addLog(`${themeXmlPath} not found`, "error")
          continue
        }

        let themeXmlContent = await themeXmlFile.async("string")

        // edits the theme.xml
        if (modConfig.includeTag !== "none") {
          // if detects that the include tag of the mod is already on the theme.xml skips it
          if (themeXmlContent.includes(modConfig.includeTag)) {
            addLog(`⚠ ${themeName} already has ${modConfig.name}, skipping...`, "warning")
            continue
          }

          // add the include thag
          themeXmlContent = themeXmlContent.replace("</themes>", `\t${modConfig.includeTag}\n</themes>`)
          zip_file.file(themeXmlPath, themeXmlContent)
          addLog(`✓ ${themeXmlPath} updated with ${modConfig.name}`, "success")
        }

        // if the mods edits a existing file
        if (modConfig.modify !== "None") {
          //for each file
          for (const [fileToModify, relativePath] of Object.entries(modConfig.modify)) {
            const fileToModifyPath = themePath + relativePath + fileToModify
            const fileToModifyFile = zip_file.file(fileToModifyPath)

            // the file wasn't found, probably happens to mods that doesn't use the default estructure (archetype)
            if (!fileToModifyFile) {
              addLog(`⚠ ${fileToModifyPath} not found, skipping...`, "warning")
              continue
            }

            let fileContent = await fileToModifyFile.async("string")

            // especific case of Color mod
            if (fileToModify === "fonts.xml") {
              const parser = new DOMParser()
              const xmlDoc = parser.parseFromString(fileContent, "text/xml")
              const fontDefs = xmlDoc.querySelectorAll("fontDef[filename]")
              let modifiedCount = 0

              // add markup
              fontDefs.forEach((fontDef) => {
                if (!fontDef.hasAttribute("markup")) {
                  fontDef.setAttribute("markup", "true")
                  modifiedCount++
                }
              })

              if (modifiedCount > 0) {
                const serializer = new XMLSerializer()
                fileContent = serializer.serializeToString(xmlDoc)
                zip_file.file(fileToModifyPath, fileContent)
                addLog(`✓ ${fileToModifyPath} modified - added markup="true" to ${modifiedCount} fontDefs`, "success")
              } else {
                addLog(`⚠ ${fileToModifyPath} - all fontDefs already have markup attribute, skipping...`, "warning")
              }
            }
          }

          // add files for mods that modify existing files
          for (const [fileName, fileData] of Object.entries(modFiles)) {
            // Get the relative path from config.files (contains full path like "counter/EC.png")
            const relativePath = modConfig.files[fileName] || `${modConfig.folderName}/${fileName}`
            const fullPath = themePath + relativePath
            zip_file.file(fullPath, fileData)
            addLog(`✓ ${fullPath} added`, "success")
          }
        } else {
          // add files that are new from the mod
          for (const [fileName, fileData] of Object.entries(modFiles)) {
            // Get the relative path from config.files (contains full path like "counter/EC.png")
            const relativePath = modConfig.files[fileName] || `${modConfig.folderName}/${fileName}`
            const fullPath = themePath + relativePath
            zip_file.file(fullPath, fileData)
            addLog(`✓ ${fullPath} added`, "success")
          }
        }
      }
    }

    addLog("\n--- Patching Theme ---", "info")
    const newZipBlob = await zip_file.generateAsync({ type: "blob" })

    // note: add the posibility to click to download instead of insta download
    const downloadLink = document.createElement("a")
    downloadLink.href = URL.createObjectURL(newZipBlob)
    downloadLink.download = uploadedFile.name.replace(".zip", ".zip")
    downloadLink.click()

    addLog("✓ Theme Downloaded!", "success")
    btnText.textContent = "Process Completed"

    modQueue.clear()

    document.querySelectorAll(".card .btn").forEach((btn) => {
      btn.textContent = "Add"
      btn.classList.remove("queued")
    })
  } catch (error) {
    addLog(`❌ Error: ${error.message}`, "error")
    console.error(error)
    btnText.textContent = "Error in processing theme"
  }
}

// Custom mod upload "normal"
async function handleCustomModUpload(e) {
  const file = e.target.files[0]
  if (file && (file.name.endsWith(".zip") || file.name.endsWith(".mod"))) {
    await processCustomMod(file)
  } else {
    addLog("Please upload a .zip or .mod file", "error")
  }
}

// Custom mod upload "drag"
customModUploadCard.addEventListener("drop", async (e) => {
  e.preventDefault()
  customModUploadCard.style.backgroundColor = ""
  const files = e.dataTransfer.files
  if (files.length > 0 && (files[0].name.endsWith(".zip") || files[0].name.endsWith(".mod"))) {
    await processCustomMod(files[0])
  } else {
    addLog("Please upload a .zip or .mod file", "error")
  }
})


// Process custom mod to extract the files
async function processCustomMod(file) {
  try {
    addLog(`Processing custom mod: ${file.name}...`, "info")

    const modZip = await JSZip.loadAsync(file)
    const infoXmlFile = modZip.file("info.xml")

    if (!infoXmlFile) {
      addLog("❌ Error: info.xml not found in mod", "error")
      return
    }

    const infoXmlContent = await infoXmlFile.async("string")
    const parser = new DOMParser()
    const infoXmlDoc = parser.parseFromString(infoXmlContent, "text/xml")

    const resourceElement = infoXmlDoc.querySelector("resource")
    if (!resourceElement) {
      addLog("❌ Error: <resource> element not found in info.xml", "error")
      return
    }

    const modName = resourceElement.getAttribute("name") || "Unknown Mod"
    const modDescription = resourceElement.getAttribute("description") || "No description"
    const modAuthor = resourceElement.getAttribute("author") || "Unknown Author"
    
    // Check if mod targets themes
    const overlays = infoXmlDoc.querySelectorAll("overlay")
    let isThemeMod = false
    let path = ""
    overlays.forEach((overlay) => {
      path = overlay.getAttribute("path")
      if (path === "data/themes/") {
        isThemeMod = true
      }
    })

    if (!isThemeMod) {
      addLog("❌ Error: Mod isn't a overlay mod", "error")
      return
    }

    // Analyze mod structure to build MOD_CONFIG
    const modConfig = await analyzeModStructure(modZip, modName, path)
    console.log(modConfig)

    // Generate unique ID for this mod
    const modId = `custom_${Date.now()}`
    MOD_CONFIGS[modId] = modConfig

    // Extract icon
    let iconUrl = null
    const iconPng = modZip.file("icon.png")
    const iconJpg = modZip.file("icon.jpg")

    if (iconPng) {
      const iconBlob = await iconPng.async("blob")
      iconUrl = URL.createObjectURL(iconBlob)
    } else if (iconJpg) {
      const iconBlob = await iconJpg.async("blob")
      iconUrl = URL.createObjectURL(iconBlob)
    }

    // Store mod files in memory
    const modFiles = {}
    for (const [fileName, filePath] of Object.entries(modConfig.files)) {
      // Find file in zip - could be in data/themes/default/ or data/themes/android/
      let file = modZip.file(`data/themes/default/${filePath}`)
      if (!file) {
        file = modZip.file(`data/themes/android/${filePath}`)
      }
      if (!file) {
        file = modZip.file(filePath)
      }
      
      if (file) {
        if (fileName.endsWith(".png") || fileName.endsWith(".jpg")) {
          modFiles[fileName] = await file.async("blob")
        } else {
          modFiles[fileName] = await file.async("string")
        }
      } else {
        console.log(`[v0] File not found: ${fileName} at ${filePath}`)
      }
    }
    modConfig._filesData = modFiles

    // Create mod card
    createModCard(modId, modName, modDescription, modAuthor, iconUrl)

    addLog(`✓ Custom mod "${modName}" loaded successfully`, "success")
  } catch (error) {
    addLog(`❌ Error loading custom mod: ${error.message}`, "error")
    console.error(error)
  }
}

// compare mods files with default theme
async function analyzeModStructure(modZip, modName, path_overlay) {
  const config = {
    name: modName,
    includeTag: "none",
    folderName: "",
    files: {},
    modify: "None",
  }

  // Get all files in the mod
  const files = Object.keys(modZip.files).filter((name) => !modZip.files[name].dir)

  // Find folders (excluding info.xml and icon files)
  const modFolders = files
    .filter((f) => !f.startsWith("info.xml") && !f.startsWith("icon."))
    .map((f) => f.replace(`${path_overlay}default/`, "").replace(`${path_overlay}android/`, ""))
    .filter((v, i, a) => a.indexOf(v) === i)
    .filter((f) => !f.startsWith("theme.xml"))
    .map((f) => f.split("/")[0])

  if (modFolders.length > 0) {
    config.folderName = modFolders[0]
  }
  else{
    config.folderName = path_overlay
  }

  // Analyze files to determine what gets added and what gets modified
  const xmlFiles = files.filter((f) => f.endsWith(".xml") && !f.includes("info.xml"))
  

  // Check for XML files that match DEFAULT_THEME structure
  const modifyFiles = {}
  const newFiles = {}

  for (const file of files) {
    if (file.startsWith("info.xml") || file.startsWith("icon.")) continue

    const fileName = file.split("/").pop()
    const fileNameWithoutExt = fileName.replace(/\.(xml|png|jpg|ttf)$/, "")
    // Get relative path from theme folder (after default/ or android/)
    const relativePath = file.replace(`${path_overlay}default/`, "").replace(`${path_overlay}android/`, "")
    
    // Check if this file modifies an existing theme file
    if (fileNameWithoutExt !== "theme"){
      if (DEFAULT_THEME.xmls.includes(fileNameWithoutExt)){
        // This file modifies an existing XML - store the path relative to theme.xml
        const pathFromTheme = relativePath.replace(fileName, "")
        modifyFiles[fileName] = pathFromTheme
      } else {
        // This is a new file to be added - fileName as key, relativePath as value
        newFiles[relativePath] = relativePath
      }
    }
  }

  // Set configuration based on analysis
  if (Object.keys(modifyFiles).length > 0) {
    config.modify = modifyFiles
  }

  config.files = newFiles

  // Check if there's a drops.xml or similar include file
  const includeXml = xmlFiles.find((f) => {
    const name = f.split("/").pop()
    return name !== "theme.xml" && !DEFAULT_THEME.xmls.includes(name.replace(".xml", ""))
  })

  if (includeXml) {
    const includeFileName = includeXml.replace(`${path_overlay}default/`, "").replace(`${path_overlay}android/`, "")
    console.log(includeFileName)
    config.includeTag = `<include filename="${includeFileName}"/>`
  }

  return config
}

function createModCard(modId, name, description, author, iconUrl) {
  const cardDiv = document.createElement("div")
  cardDiv.className = "card dark"

  let cardHTML = ""

  if (iconUrl) {
    cardHTML += `<img src="${iconUrl}" class="card-img-top" alt="${name}">`
  }

  cardHTML += `
    <div class="card-body">
      <div class="text-section">
        <h5 class="card-title fw-bold">${name}</h5>
        <p class="card-text">${description}<br>[By ${author}]</p>
      </div>
      <div class="cta-section">
        <a class="btn custom-button-smol" data-mod-id="${modId}">Add</a>
      </div>
    </div>
  `

  cardDiv.innerHTML = cardHTML

  const btn = cardDiv.querySelector(".btn")
  btn.addEventListener("click", () => toggleModInQueue(modId, btn))

  // Insert after the upload card
  customModUploadCard.insertAdjacentElement("afterend", cardDiv)
}

document.addEventListener("DOMContentLoaded", () => {
  const addButtons = document.querySelectorAll(".card .btn")
  addButtons.forEach((btn, index) => {
    const modIds = ["fancy", "numbers", "colormod"]
    const modId = modIds[index]
    btn.addEventListener("click", () => toggleModInQueue(modId, btn))
  })
})

// Add the mod to the queue
function toggleModInQueue(modId, buttonElement) {
  if (modQueue.has(modId)) {
    modQueue.delete(modId)
    buttonElement.textContent = "Add"
    buttonElement.classList.remove("queued")
    addLog(`${MOD_CONFIGS[modId].name} removed from queue`, "info")
  } else {
    modQueue.add(modId)
    buttonElement.textContent = "Remove"
    buttonElement.classList.add("queued")
    addLog(`${MOD_CONFIGS[modId].name} added to queue`, "info")
  }
}