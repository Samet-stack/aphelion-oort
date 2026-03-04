import { jsPDF } from "jspdf";
import fs from "fs";

try {
    const doc = new jsPDF();
    doc.text("Ce fichier PDF sert de test pour l'upload dans le formulaire !", 10, 10);
    const buffer = doc.output('arraybuffer');
    fs.writeFileSync('test_upload.pdf', Buffer.from(buffer));
    console.log('PDF de test generé avec succes dans test_upload.pdf');
} catch (e) {
    console.error('Erreur lors de la creation du PDF:', e);
}
