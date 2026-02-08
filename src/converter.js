let uploadedFile = null

const mod1Data = {
    zip: null,
    info: null,
    files: {},
    icon: null,
    folderName: null,
    themeXmlPath: null
}


const modUpload1 = document.getElementById("modUpload1")
const modInput1 = document.getElementById("modInput1")
const modPreview1 = document.getElementById("modPreview1")
const modRemove1 = document.getElementById("modRemove1")
const mergeBtn = document.getElementById("mergeBtn")
const mergeBtnText = document.getElementById("mergeBtnText")
const logEl = document.getElementById("log")
const logButton = document.getElementById("log_button")

// Setup event listeners
function setupModSlot(uploadArea, input, removeBtn, modData) {
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
        await loadMod(files[0], modData)
        }
    })

    input.addEventListener("change", async (e) => {
        if (e.target.files.length > 0) {
        const file = e.target.files[0]
        if (file.name.endsWith(".zip") || file.name.endsWith(".mod")) {
            await loadMod(file, modData)
        }
        }
    })

    removeBtn.addEventListener("click", () => {
        clearMod(modData)
    })
}

setupModSlot(modUpload1, modInput1, modRemove1, mod1Data)

// Load mod from zip file
async function loadMod(file, modData) {
    try {
        const JSZip = window.JSZip;
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
            version: resource.getAttribute("version") || "1.0",
            weblink: resource.getAttribute("weblink") || "1.0"
        }

        // Find overlay path
        const extension = infoXml.querySelector("theme_extensions ")
        if (extension) {
            alert("Invalid mod: theme already updated")
            return
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

            // Determine folder name from first file
            if (!modData.themeXmlPath && fileName.endsWith(".xml")) {
                modData.themeXmlPath = relativePath
            }

            if(fileNameWithoutExt != "theme"){
                // Store file info
                modData.files[fileName] = {
                    path: relativePath,
                    fullPath: filePath,
                    isXml: fileName.endsWith(".xml")
                }
            }
        }

        // Update UI
        updateModPreview(modData)
        updateMergePreview()
        console.log(modData)

    } catch (error) {
        console.error("Error loading mod:", error)
        alert("Error loading mod: " + error.message)
    }
}

function clearMod(modData) {
    modData.zip = null
    modData.info = null
    modData.files = {}
    modData.icon = null
    modData.folderName = null

    const uploadArea = document.getElementById(`modUpload1`)
    const preview = document.getElementById(`modPreview1`)

    uploadArea.style.display = "flex"
    preview.style.display = "none"

    updateMergePreview()
}

function updateModPreview(modData) {
    const uploadArea = document.getElementById(`modUpload1`)
    const preview = document.getElementById(`modPreview1`)
    const iconEl = document.getElementById(`modIcon1`)
    const nameEl = document.getElementById(`modName1`)
    const authorEl = document.getElementById(`modAuthor1`)
    const filesEl = document.getElementById(`modFiles1`)

    uploadArea.style.display = "none"
    preview.style.display = "flex"

    if (modData.icon) {
        iconEl.src = modData.icon
    } else {
        iconEl.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect fill='%23555' width='60' height='60'/%3E%3Ctext x='50%25' y='50%25' fill='%23888' text-anchor='middle' dy='.3em'%3EMod%3C/text%3E%3C/svg%3E"
    }

    nameEl.textContent = modData.info.name
    authorEl.textContent = `By ${modData.info.author}`
    
    filesEl.textContent = "Ready to convert"
}

function updateMergePreview() {
    const hasBothMods = mod1Data.zip

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
    if (!mod1Data.zip) return

    mergeBtn.disabled = true
    mergeBtnText.innerHTML = '<span class="spinner"></span>Merging...'
    logEl.classList.add("show")
    logEl.innerHTML = ""
    logButton.style = "background-color: transparent;"

    try {
        await ConvertMod()
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

async function ConvertMod() {

    addLog("Starting conversion...", "info")

    const JSZip = window.JSZip
    const newZip = new JSZip()

    const targetFolder = mod1Data.folderName

    if (!targetFolder) {
        throw new Error("Could not determine target folder")
    }

    addLog(`Target folder: ${targetFolder}/`, "info")


    // copiar todos los archivos al nuevo folder
    addLog("Copying files...", "info")

    for (const fileInfo of Object.values(mod1Data.files)) {

        const file = mod1Data.zip.file(fileInfo.fullPath)

        if (!file) continue

        const content = await file.async("blob")

        const newPath = `${targetFolder}/${fileInfo.path}`

        newZip.file(newPath, content)

        addLog(`+ ${newPath}`, "success")
    }


    // copiar icon
    const iconFile =
        mod1Data.zip.file("icon.png") ||
        mod1Data.zip.file("icon.jpg")

    if (iconFile) {

        const iconContent = await iconFile.async("blob")

        const iconName =
        mod1Data.zip.file("icon.png")
            ? "icon.png"
            : "icon.jpg"

        newZip.file(iconName, iconContent)

        addLog(`+ ${iconName}`, "success")
    }


    // generar nuevo info.xml
    addLog("Generating info.xml...", "info")


    const infoXml =
    `<?xml version="1.0" encoding="UTF-8"?>

    <resource
    name="${mod1Data.info.name}"
    version="${mod1Data.info.version}"
    description="${mod1Data.info.description}"
    author="${mod1Data.info.author}"
    weblink="${mod1Data.info.weblink}">

        <theme_extensions theme_extension_revision="1">
            <theme_extension
                name="${mod1Data.info.name}"
                path="${targetFolder}/${mod1Data.themeXmlPath}"/>
        </theme_extensions>

    </resource>
    `

    newZip.file("info.xml", infoXml)

    addLog("+ info.xml", "success")


    // generar zip final
    addLog("Generating mod file...", "info")

    const blob = await newZip.generateAsync({ type: "blob" })


    const link = document.createElement("a")

    link.href = URL.createObjectURL(blob)

    link.download =
        mod1Data.info.name.replace(/\s+/g, "_") +
        "_extension.zip"

    link.click()


    addLog("Conversion complete!", "success")

}
