const html2canvas = window.html2canvas


function generatePDF() {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 15;
    log_list.forEach(log => {
        let type = log.match(/\[(.*?)\]/)[1];
        switch(type){
            case "info":
                doc.setTextColor(0, 0, 255); // blue
                break;
            case "warning":
                doc.setTextColor(255, 165, 0); // orange
                break;
            case "error":
                doc.setTextColor(255, 0, 0); // red
                break;
            case "success":
                doc.setTextColor(0, 200, 0); // green
                break;
            default:
                doc.setTextColor(0, 0, 0);
        }
        doc.text(log, 10, y);
        y += 10;
        if (y > 280){
            doc.addPage();
            y = 10;
        }
    });

    doc.save("logs.pdf");
}