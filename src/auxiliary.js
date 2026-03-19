const html2canvas = window.html2canvas


function generatePDF() {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 15;
    log_list.forEach(log => {
        let type = log.match(/\[(.*?)\]/)[1];
        switch(type){
            case "info":
                doc.setTextColor(0, 0, 255); // azul
                break;
            case "warning":
                doc.setTextColor(255, 165, 0); // naranja
                break;
            case "error":
                doc.setTextColor(255, 0, 0); // rojo
                break;
            default:
                doc.setTextColor(0, 0, 0);
        }
        doc.text(log, 10, y);
        y += 10;
        // salto de página si es necesario
        if (y > 280){
            doc.addPage();
            y = 10;
        }
    });

    doc.save("logs.pdf");
}