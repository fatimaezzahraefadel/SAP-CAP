const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', 'db', 'data');

// Helpers
const toCSV = (data) => {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(header => {
      let val = row[header];
      if (val === null || val === undefined) return '';
      if (typeof val === 'boolean') return val; // Important for HANA
      if (typeof val === 'string') {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(';')
  );
  return [headers.join(';'), ...rows].join('\n');
};

const writeCSV = (filename, data) => {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, toCSV(data), 'utf8');
  console.log(`Generated ${data.length} records in ${filename}`);
};

const dateIso = (date) => date.toISOString().slice(0, 19) + 'Z';

// Constants
const SKILLS = ['ABAP', 'SAP Fiori', 'SAP UI5', 'SAP MM', 'SAP SD', 'SAP FI', 'SAP CO', 'OData', 'CDS Views', 'BTP', 'Node.js', 'Workflow', 'Adobe Forms'];
const MODULES = ['FI', 'CO', 'MM', 'SD', 'PP', 'PM', 'QM', 'HR', 'PS', 'WM', 'BASIS', 'ABAP', 'FIORI', 'BW', 'OTHER'];
const NATURES = ['WORKFLOW', 'FORMULAIRE', 'PROGRAMME', 'ENHANCEMENT', 'MODULE', 'REPORT'];
const COMPLEXITIES = ['SIMPLE', 'MOYEN', 'COMPLEXE', 'TRES_COMPLEXE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const SAP_TITLES = [
  "Mise à jour du flux de facturation FI",
  "Correction dump ABAP sur module SD",
  "Création formulaire Adobe MM",
  "Analyse performance transaction ZFI01",
  "Nouveau workflow d'approbation d'achats",
  "Ajout champ spécifique dans la BAdI MB_DOCUMENT_BADI",
  "Création vue CDS pour reporting ventes",
  "Erreur de lettrage automatique des comptes clients",
  "Extension de l'application Fiori My Inbox",
  "Création d'un programme d'extraction des articles",
  "Paramétrage du nouveau code TVA",
  "Bug d'affichage dans le rapport ALV des stocks",
  "Création interface OData pour application externe",
  "Modification du layout de la facture PDF",
  "Optimisation du programme de relance",
  "Problème d'intégration Idoc avec le système logistique",
  "Développement d'un user-exit pour la commande de vente",
  "Mise en place d'un report spécifique CO-PA"
];

// Generate Users
const users = [];
const userSkills = [];
const techConsultantIds = [];
const functionalConsultantIds = [];
const managerIds = [];

// Create 5 Managers
for(let i=0; i<5; i++) {
  const id = uuidv4();
  managerIds.push(id);
  users.push({
    ID: id,
    createdAt: dateIso(faker.date.past()),
    createdBy: 'system',
    modifiedAt: dateIso(faker.date.recent()),
    modifiedBy: 'system',
    name: faker.person.fullName(),
    email: faker.internet.email(),
    role: 'MANAGER',
    active: true, // boolean, not string
    availabilityPercent: 100,
    teamId: 'TEAM_' + faker.string.alphanumeric(4).toUpperCase(),
    avatarUrl: faker.image.avatar()
  });
}

// Create 5 Functional Consultants
for(let i=0; i<5; i++) {
  const id = uuidv4();
  functionalConsultantIds.push(id);
  users.push({
    ID: id,
    createdAt: dateIso(faker.date.past()),
    createdBy: 'system',
    modifiedAt: dateIso(faker.date.recent()),
    modifiedBy: 'system',
    name: faker.person.fullName(),
    email: faker.internet.email(),
    role: 'CONSULTANT_FONCTIONNEL',
    active: true,
    availabilityPercent: faker.number.int({ min: 50, max: 100 }),
    teamId: 'TEAM_' + faker.string.alphanumeric(4).toUpperCase(),
    avatarUrl: faker.image.avatar()
  });
}

// Create 50 Technical Consultants
for(let i=0; i<50; i++) {
  const id = uuidv4();
  techConsultantIds.push(id);
  users.push({
    ID: id,
    createdAt: dateIso(faker.date.past()),
    createdBy: 'system',
    modifiedAt: dateIso(faker.date.recent()),
    modifiedBy: 'system',
    name: faker.person.fullName(),
    email: faker.internet.email(),
    role: 'CONSULTANT_TECHNIQUE',
    active: true,
    availabilityPercent: faker.number.int({ min: 10, max: 100 }),
    teamId: 'TEAM_' + faker.string.alphanumeric(4).toUpperCase(),
    avatarUrl: faker.image.avatar()
  });

  // Assign 2 to 5 skills to each tech consultant
  const numSkills = faker.number.int({ min: 2, max: 5 });
  const shuffledSkills = faker.helpers.shuffle(SKILLS);
  for(let j=0; j<numSkills; j++) {
    userSkills.push({
      ID: uuidv4(),
      user_ID: id,
      skill: shuffledSkills[j]
    });
  }
}

// Generate Projects
const projects = [];
const projectIds = [];
for(let i=0; i<10; i++) {
  const id = uuidv4();
  projectIds.push(id);
  projects.push({
    ID: id,
    createdAt: dateIso(faker.date.past()),
    createdBy: 'system',
    modifiedAt: dateIso(faker.date.recent()),
    modifiedBy: 'system',
    name: faker.company.catchPhrase() + ' Project',
    projectType: faker.helpers.arrayElement(['TMA', 'BUILD']),
    managerId: faker.helpers.arrayElement(managerIds),
    startDate: dateIso(faker.date.past()),
    endDate: dateIso(faker.date.future()),
    status: 'ACTIVE',
    priority: faker.helpers.arrayElement(PRIORITIES),
    description: faker.lorem.paragraph(),
    progress: faker.number.int({ min: 10, max: 90 }),
    complexity: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH']),
    documentation: ''
  });
}

// Generate Tickets
const tickets = [];
let ticketCounter = 1000;

// 300 Closed tickets (DONE) distributed among tech consultants
for(let i=0; i<300; i++) {
  const techId = faker.helpers.arrayElement(techConsultantIds);
  const funcId = faker.helpers.arrayElement(functionalConsultantIds);
  const effort = faker.number.int({ min: 4, max: 40 });
  tickets.push({
    ID: uuidv4(),
    createdAt: dateIso(faker.date.past()),
    createdBy: funcId,
    modifiedAt: dateIso(faker.date.recent()),
    modifiedBy: funcId,
    ticketCode: `TK-2026-${ticketCounter++}`,
    projectId: faker.helpers.arrayElement(projectIds),
    assignedTo: techId,
    assignedToRole: 'CONSULTANT_TECHNIQUE',
    status: 'DONE',
    priority: faker.helpers.arrayElement(PRIORITIES),
    nature: faker.helpers.arrayElement(NATURES),
    title: faker.helpers.arrayElement(SAP_TITLES),
    description: faker.lorem.paragraph(),
    dueDate: dateIso(faker.date.recent()),
    effortHours: effort,
    effortComment: faker.lorem.sentence(),
    functionalTesterId: funcId,
    wricefId: '',
    module: faker.helpers.arrayElement(MODULES),
    estimationHours: effort + faker.number.int({ min: -2, max: 5 }),
    complexity: faker.helpers.arrayElement(COMPLEXITIES),
    estimatedViaAbaque: faker.datatype.boolean() ? 'true' : 'false',
    allocatedHours: effort + faker.number.int({ min: 0, max: 10 }),
    updatedAt: dateIso(faker.date.recent())
  });
}

// 20 New unassigned tickets
for(let i=0; i<20; i++) {
  const funcId = faker.helpers.arrayElement(functionalConsultantIds);
  const est = faker.number.int({ min: 8, max: 60 });
  tickets.push({
    ID: uuidv4(),
    createdAt: dateIso(faker.date.recent()),
    createdBy: funcId,
    modifiedAt: dateIso(faker.date.recent()),
    modifiedBy: funcId,
    ticketCode: `TK-2026-${ticketCounter++}`,
    projectId: faker.helpers.arrayElement(projectIds),
    assignedTo: '',
    assignedToRole: '',
    status: 'NEW',
    priority: faker.helpers.arrayElement(PRIORITIES),
    nature: faker.helpers.arrayElement(NATURES),
    title: '[NOUVEAU] ' + faker.helpers.arrayElement(SAP_TITLES),
    description: faker.lorem.paragraph(),
    dueDate: dateIso(faker.date.future()),
    effortHours: 0,
    effortComment: '',
    functionalTesterId: funcId,
    wricefId: '',
    module: faker.helpers.arrayElement(MODULES),
    estimationHours: est,
    complexity: faker.helpers.arrayElement(COMPLEXITIES),
    estimatedViaAbaque: 'true',
    allocatedHours: 0,
    updatedAt: dateIso(faker.date.recent())
  });
}

// Output
console.log('Generating CSVs into', DATA_DIR);
writeCSV('sap.performance.dashboard.db-Users.csv', users);
writeCSV('sap.performance.dashboard.db-UserSkills.csv', userSkills);
writeCSV('sap.performance.dashboard.db-Projects.csv', projects);
writeCSV('sap.performance.dashboard.db-Tickets.csv', tickets);
console.log('Done!');
