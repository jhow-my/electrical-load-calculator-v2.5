import fs from 'fs';
import path from 'path';
import {
  DEFAULT_COPPER_CABLE_DEFINITIONS,
  DEFAULT_ALUMINIUM_CABLE_DEFINITIONS,
  DEFAULT_COPPER_CABLE_SCHEDULE,
  DEFAULT_ALUMINIUM_CABLE_SCHEDULE,
  DEFAULT_CABLE_DEFINITIONS,
  DEFAULT_CABLE_SCHEDULE,
  recalculateAll,
} from '../src/utils/electricalCalculations';

const filesToUpdate = [
  path.resolve(process.cwd(), 'src/data/mediniManagementTemplate.json'),
  path.resolve(process.cwd(), 'src/data/mediniResidentialTowerBusductTemplate.json'),
  path.resolve(process.cwd(), 'src/data/mediniResidentialTowerTemplate.json'),
  path.resolve(process.cwd(), 'public/assets/aistudio/C11_Medini_-_Management_Template_98b9d82e.json'),
  path.resolve(process.cwd(), 'public/assets/aistudio/C11_Medini_-_Management_Template_9edb9241.json'),
  path.resolve(process.cwd(), 'public/assets/aistudio/C11_Medini_-_Residential_Tower_Busduct_bc98ef41.json'),
  path.resolve(process.cwd(), 'public/assets/aistudio/C11_Medini_-_Residential_Tower_Template_f9f8c8f9.json'),
];

for (const filePath of filesToUpdate) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping non-existent file: ${filePath}`);
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const template = JSON.parse(raw);
  const proj = template.projectData || template;

  // 1. Update cable definitions to full 78 conductors
  proj.cableDefinitions = JSON.parse(JSON.stringify(DEFAULT_CABLE_DEFINITIONS));

  // 2. Update cable schedule to full 60 protective breakers
  proj.cableSchedule = JSON.parse(JSON.stringify(DEFAULT_CABLE_SCHEDULE));

  // 3. Re-run recalculateAll to update all boards, incomers, voltage drop calculations
  const primaryMsb = proj.msb || proj.msbs?.[0];
  const calculated = recalculateAll(
    proj.dbs || [],
    proj.subDbs || [],
    primaryMsb,
    proj.msbDirectLoads || [],
    proj.voltageSystem,
    proj.cableSchedule,
    proj.msbs && proj.msbs.length > 0 ? proj.msbs : primaryMsb ? [primaryMsb] : [],
    proj.cableDefinitions
  );

  proj.dbs = calculated.dbs;
  proj.subDbs = calculated.subDbs;
  proj.msb = calculated.msbs?.[0] || calculated.msb;
  proj.msbs = calculated.msbs;
  proj.msbDirectLoads = calculated.directLoads;

  // Update stats if top-level template has stats
  if (template.stats) {
    const totalDemand =
      proj.msbs && proj.msbs.length > 0
        ? proj.msbs.reduce((acc: number, m: any) => acc + (m.totalPlantMaximumDemandKW || 0), 0)
        : (proj.msb?.totalPlantMaximumDemandKW || 0);

    const totalConnected =
      proj.msbs && proj.msbs.length > 0
        ? proj.msbs.reduce((acc: number, m: any) => acc + (m.connectedLoadKW || 0), 0)
        : (proj.msb?.connectedLoadKW || 0);

    template.stats = {
      ...template.stats,
      totalDemandKW: Math.round(totalDemand * 10) / 10,
      totalConnectedKW: Math.round(totalConnected * 10) / 10,
    };
  }

  fs.writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf8');
  console.log(`Successfully updated: ${filePath}`);
}

console.log('All project templates updated successfully.');
