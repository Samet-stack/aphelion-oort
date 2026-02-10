// Migration rapide pour ajouter les colonnes plan_point_id et plan_id
import dotenv from 'dotenv';
dotenv.config();

import { getPool } from './database.js';

async function migrate() {
  const db = getPool();
  
  console.log('🔧 Migration: Ajout des colonnes plan_point_id et plan_id...');
  
  try {
    // Vérifier si la colonne existe déjà
    const checkResult = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'reports' AND column_name = 'plan_point_id'
    `);
    
    if (checkResult.rows.length === 0) {
      await db.query(`
        ALTER TABLE reports 
        ADD COLUMN plan_point_id UUID REFERENCES plan_points(id) ON DELETE SET NULL
      `);
      console.log('✅ Colonne plan_point_id ajoutée');
    } else {
      console.log('ℹ️ Colonne plan_point_id existe déjà');
    }
    
    const checkPlanId = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'reports' AND column_name = 'plan_id'
    `);
    
    if (checkPlanId.rows.length === 0) {
      await db.query(`
        ALTER TABLE reports 
        ADD COLUMN plan_id UUID REFERENCES plans(id) ON DELETE SET NULL
      `);
      console.log('✅ Colonne plan_id ajoutée');
    } else {
      console.log('ℹ️ Colonne plan_id existe déjà');
    }
    
    // Créer les indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_plan_point ON reports(plan_point_id)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_plan ON reports(plan_id)
    `);
    console.log('✅ Index créés');
    
    console.log('✅ Migration terminée avec succès !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur migration:', error.message);
    process.exit(1);
  }
}

migrate();
