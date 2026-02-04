const html2canvas = window.html2canvas

async function exportLogToPDF() {
  const logElement = document.getElementById("log")

  if (!logElement || logElement.innerText.trim() === "") {
    alert("Log is empty")
    return
  }

  // Forzar que se vea completo (sin scroll)
  const originalMaxHeight = logElement.style.maxHeight
  const originalOverflow = logElement.style.overflow

  logElement.style.maxHeight = "none"
  logElement.style.overflow = "visible"

  const canvas = await html2canvas(logElement, {
    scale: 2,
    backgroundColor: "#f8f9ff"
  })

  const imgData = canvas.toDataURL("image/png")
  const { jsPDF } = window.jspdf

  const pdf = new jsPDF("p", "mm", "a4")
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width

  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
  pdf.save("mod_log.pdf")

  // Restaurar estilos
  logElement.style.maxHeight = originalMaxHeight
  logElement.style.overflow = originalOverflow
}
