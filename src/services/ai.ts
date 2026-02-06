export const generateDescription = async (_file: File) => {
    // Simulation of AI analysis - user requested NO real AI integration
    await new Promise(r => setTimeout(r, 2000));
    return "Inspection complétée. Le chantier présente une progression conforme au planning. Les équipes sont en place et les matériaux (béton, acier) sont correctement stockés. Aucune anomalie majeure de sécurité détectée.";
};
