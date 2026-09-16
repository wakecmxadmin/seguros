import { Modal, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed das tabelas de domínio.
 *
 * Os países vêm da ISO 3166-1, não do legado: lá havia ~220 registros com lixo
 * (`..`, `...`) e duplicatas (Bélgica ×2, Índia/índia/India, Coréia/Korea/Coréia do Sul,
 * Ghana/GANA…) — ver docs/10-dores-e-melhorias.md (item 8).
 */
const COUNTRIES: Array<[string, string, string]> = [
  ['Brasil', 'BR', 'BRA'], ['Estados Unidos', 'US', 'USA'], ['China', 'CN', 'CHN'],
  ['Alemanha', 'DE', 'DEU'], ['Argentina', 'AR', 'ARG'], ['Itália', 'IT', 'ITA'],
  ['Japão', 'JP', 'JPN'], ['Espanha', 'ES', 'ESP'], ['França', 'FR', 'FRA'],
  ['Reino Unido', 'GB', 'GBR'], ['Coreia do Sul', 'KR', 'KOR'], ['Índia', 'IN', 'IND'],
  ['México', 'MX', 'MEX'], ['Chile', 'CL', 'CHL'], ['Canadá', 'CA', 'CAN'],
  ['Holanda', 'NL', 'NLD'], ['Bélgica', 'BE', 'BEL'], ['Portugal', 'PT', 'PRT'],
  ['Suíça', 'CH', 'CHE'], ['Suécia', 'SE', 'SWE'], ['Áustria', 'AT', 'AUT'],
  ['Taiwan', 'TW', 'TWN'], ['Turquia', 'TR', 'TUR'], ['Vietnã', 'VN', 'VNM'],
  ['Tailândia', 'TH', 'THA'], ['Indonésia', 'ID', 'IDN'], ['Malásia', 'MY', 'MYS'],
  ['Singapura', 'SG', 'SGP'], ['Austrália', 'AU', 'AUS'], ['Nova Zelândia', 'NZ', 'NZL'],
  ['Uruguai', 'UY', 'URY'], ['Paraguai', 'PY', 'PRY'], ['Bolívia', 'BO', 'BOL'],
  ['Peru', 'PE', 'PER'], ['Colômbia', 'CO', 'COL'], ['Equador', 'EC', 'ECU'],
  ['Venezuela', 'VE', 'VEN'], ['África do Sul', 'ZA', 'ZAF'], ['Egito', 'EG', 'EGY'],
  ['Marrocos', 'MA', 'MAR'], ['Nigéria', 'NG', 'NGA'], ['Quênia', 'KE', 'KEN'],
  ['Rússia', 'RU', 'RUS'], ['Polônia', 'PL', 'POL'], ['República Tcheca', 'CZ', 'CZE'],
  ['Hungria', 'HU', 'HUN'], ['Romênia', 'RO', 'ROU'], ['Grécia', 'GR', 'GRC'],
  ['Dinamarca', 'DK', 'DNK'], ['Noruega', 'NO', 'NOR'], ['Finlândia', 'FI', 'FIN'],
  ['Irlanda', 'IE', 'IRL'], ['Israel', 'IL', 'ISR'], ['Emirados Árabes Unidos', 'AE', 'ARE'],
  ['Arábia Saudita', 'SA', 'SAU'], ['Catar', 'QA', 'QAT'], ['Paquistão', 'PK', 'PAK'],
  ['Bangladesh', 'BD', 'BGD'], ['Filipinas', 'PH', 'PHL'], ['Hong Kong', 'HK', 'HKG'],
  ['Panamá', 'PA', 'PAN'], ['Costa Rica', 'CR', 'CRI'], ['Guatemala', 'GT', 'GTM'],
  ['República Dominicana', 'DO', 'DOM'], ['Cuba', 'CU', 'CUB'], ['Ucrânia', 'UA', 'UKR'],
];

/** UFs brasileiras — a origem/destino nacional é sempre o Brasil. */
const BR_STATES: Array<[string, string]> = [
  ['Acre', 'AC'], ['Alagoas', 'AL'], ['Amapá', 'AP'], ['Amazonas', 'AM'],
  ['Bahia', 'BA'], ['Ceará', 'CE'], ['Distrito Federal', 'DF'], ['Espírito Santo', 'ES'],
  ['Goiás', 'GO'], ['Maranhão', 'MA'], ['Mato Grosso', 'MT'], ['Mato Grosso do Sul', 'MS'],
  ['Minas Gerais', 'MG'], ['Pará', 'PA'], ['Paraíba', 'PB'], ['Paraná', 'PR'],
  ['Pernambuco', 'PE'], ['Piauí', 'PI'], ['Rio de Janeiro', 'RJ'], ['Rio Grande do Norte', 'RN'],
  ['Rio Grande do Sul', 'RS'], ['Rondônia', 'RO'], ['Roraima', 'RR'], ['Santa Catarina', 'SC'],
  ['São Paulo', 'SP'], ['Sergipe', 'SE'], ['Tocantins', 'TO'],
];

/** As 12 moedas que o legado já tinha, agora com código ISO 4217. */
const CURRENCIES: Array<[string, string, string]> = [
  ['BRL', 'Real', 'R$'], ['USD', 'Dólar dos EUA', 'US$'], ['EUR', 'Euro', '€'],
  ['JPY', 'Iene', '¥'], ['CHF', 'Franco Suíço', 'CHF'], ['SEK', 'Coroa Sueca', 'kr'],
  ['GBP', 'Libra Esterlina', '£'], ['CAD', 'Dólar Canadense', 'C$'],
  ['CNY', 'Yuan Renminbi', '¥'], ['AUD', 'Dólar Australiano', 'A$'],
  ['NOK', 'Coroa Norueguesa', 'kr'], ['DKK', 'Coroa Dinamarquesa', 'kr'],
];

/** As 47 embalagens do legado, sem duplicatas. */
const PACKAGINGS = [
  'ADEQUADA', 'AMARRADOS', 'AMPOLAS', 'BALDES AÇO', 'BALDES FERRO', 'BARRIS', 'BIDÕES',
  'BOBINAS', 'BOMBONAS ALUMÍNIO', 'BOMBONAS PLÁSTICO', 'BOMBONAS VIDRO PROTEGIDO',
  'BOTIJAS FIBRA', 'BOTIJAS PAPELÃO', 'BOTIJAS PLÁSTICAS', 'CILINDROS', 'CONTAINER',
  'CORREIO', 'CX. MADEIRA', 'CX. PAPELÃO', 'ENGRADADOS', 'FARDOS', 'FRASCOS ALUMÍNIO',
  'FRASCOS PLÁSTICO', 'FRASCOS VIDRO EM CX. MADEIRA', 'FRASCOS VIDRO EM CX. PAPELÃO',
  'GARRAFAS', 'GARRAFAS - VIDRO', 'GRANEL - LÍQUIDO', 'GRANEL - SÓLIDO', 'LATAS',
  'LIFT-VAN-MUDANÇAS', 'PACOTES', 'POTES', 'RAMAS', 'SACOS JUTA', 'SACOS PAPELÃO',
  'SACOS PLÁSTICO', 'SEM EMBALAGEM', 'TAMBORES AÇO', 'TAMBORES FERRO', 'TAMBORES FIBRAS',
  'TAMBORES LATÃO', 'TAMBORES MADEIRA', 'TAMBORES METAL', 'TAMBORES PAPELÃO',
  'TAMBORES PLÁSTICO', 'TAMBORES ZINCO',
];

/** Cláusulas ICC principais + acessórias observadas no legado. */
const COVERAGES: Array<{ name: string; accessory: boolean; description: string }> = [
  { name: 'Básica Ampla "A"', accessory: false, description: 'ICC (A) — todos os riscos.' },
  { name: 'Básica Restrita "B"', accessory: false, description: 'ICC (B) — riscos nomeados, cobertura intermediária.' },
  { name: 'Básica Restrita "C"', accessory: false, description: 'ICC (C) — riscos nomeados, cobertura mínima.' },
  { name: 'Guerra e Greve', accessory: true, description: 'GTM/GMCC — guerra, greves, tumultos e motins.' },
  { name: 'Paralisação Máquina/Refrigeração', accessory: true, description: 'Falha de equipamento de refrigeração em carga perecível.' },
  { name: 'Despesas', accessory: true, description: 'Inclui a verba de despesas na importância segurada.' },
  { name: 'Lucros Esperados', accessory: true, description: 'Inclui a verba de lucros esperados na importância segurada.' },
  { name: 'Prêmio Mínimo', accessory: true, description: 'Aplica o piso de prêmio da apólice ao lado do cliente.' },
  { name: 'Transbordo', accessory: true, description: 'Cobre a operação de transbordo entre modais ou embarcações.' },
  { name: 'Carta de Crédito', accessory: true, description: 'Adicional de carta de crédito (exportação).' },
];

/** Principais portos e aeroportos do Brasil, com UN/LOCODE e IATA. */
const BR_PORTS: Array<[string, string, Modal, string]> = [
  ['Porto de Santos', 'BRSSZ', Modal.SEA, 'SP'],
  ['Porto de Paranaguá', 'BRPNG', Modal.SEA, 'PR'],
  ['Porto de Itajaí', 'BRITJ', Modal.SEA, 'SC'],
  ['Porto de Navegantes', 'BRNVT', Modal.SEA, 'SC'],
  ['Porto de Rio Grande', 'BRRIG', Modal.SEA, 'RS'],
  ['Porto de Itapoá', 'BRIOA', Modal.SEA, 'SC'],
  ['Porto do Rio de Janeiro', 'BRRIO', Modal.SEA, 'RJ'],
  ['Porto de Vitória', 'BRVIX', Modal.SEA, 'ES'],
  ['Porto de Suape', 'BRSUA', Modal.SEA, 'PE'],
  ['Porto de Salvador', 'BRSSA', Modal.SEA, 'BA'],
  ['Porto de Manaus', 'BRMAO', Modal.SEA, 'AM'],
  ['Aeroporto de Guarulhos', 'GRU', Modal.AIR, 'SP'],
  ['Aeroporto de Viracopos', 'VCP', Modal.AIR, 'SP'],
  ['Aeroporto de Curitiba (Afonso Pena)', 'CWB', Modal.AIR, 'PR'],
  ['Aeroporto do Galeão', 'GIG', Modal.AIR, 'RJ'],
  ['Aeroporto de Confins', 'CNF', Modal.AIR, 'MG'],
  ['Aeroporto de Porto Alegre', 'POA', Modal.AIR, 'RS'],
  ['Aeroporto de Manaus (Eduardo Gomes)', 'MAO', Modal.AIR, 'AM'],
  ['Aeroporto de Recife', 'REC', Modal.AIR, 'PE'],
];

/** Portos estrangeiros mais usados nos processos observados. */
const FOREIGN_PORTS: Array<[string, string, Modal, string]> = [
  ['Port of Shanghai', 'CNSHA', Modal.SEA, 'CN'],
  ['Port of Ningbo', 'CNNGB', Modal.SEA, 'CN'],
  ['Port of Shenzhen', 'CNSZX', Modal.SEA, 'CN'],
  ['Port of Qingdao', 'CNTAO', Modal.SEA, 'CN'],
  ['Port of Guangzhou', 'CNCAN', Modal.SEA, 'CN'],
  ['Port of Hong Kong', 'HKHKG', Modal.SEA, 'HK'],
  ['Port of Busan', 'KRPUS', Modal.SEA, 'KR'],
  ['Port of Singapore', 'SGSIN', Modal.SEA, 'SG'],
  ['Port of Rotterdam', 'NLRTM', Modal.SEA, 'NL'],
  ['Port of Antwerp', 'BEANR', Modal.SEA, 'BE'],
  ['Port of Hamburg', 'DEHAM', Modal.SEA, 'DE'],
  ['Port of Valencia', 'ESVLC', Modal.SEA, 'ES'],
  ['Port of Genoa', 'ITGOA', Modal.SEA, 'IT'],
  ['Port of New York', 'USNYC', Modal.SEA, 'US'],
  ['Port of Los Angeles', 'USLAX', Modal.SEA, 'US'],
  ['Port of Houston', 'USHOU', Modal.SEA, 'US'],
  ['Port of Miami', 'USMIA', Modal.SEA, 'US'],
  ['Port of Buenos Aires', 'ARBUE', Modal.SEA, 'AR'],
  ['Port of Montevideo', 'UYMVD', Modal.SEA, 'UY'],
  ['Shanghai Pudong Airport', 'PVG', Modal.AIR, 'CN'],
  ['Hong Kong Airport', 'HKG', Modal.AIR, 'HK'],
  ['Frankfurt Airport', 'FRA', Modal.AIR, 'DE'],
  ['Schiphol Airport', 'AMS', Modal.AIR, 'NL'],
  ['Miami Airport', 'MIA', Modal.AIR, 'US'],
  ['JFK Airport', 'JFK', Modal.AIR, 'US'],
];

async function main() {
  console.log('→ Países…');
  for (const [name, iso2, iso3] of COUNTRIES) {
    await prisma.country.upsert({
      where: { iso2 },
      update: { name, iso3 },
      create: { name, iso2, iso3 },
    });
  }
  console.log(`  ${COUNTRIES.length}`);

  const brazil = await prisma.country.findUniqueOrThrow({ where: { iso2: 'BR' } });

  console.log('→ Estados do Brasil…');
  for (const [name, code] of BR_STATES) {
    await prisma.state.upsert({
      where: { countryId_name: { countryId: brazil.id, name } },
      update: { code },
      create: { name, code, countryId: brazil.id },
    });
  }
  console.log(`  ${BR_STATES.length}`);

  console.log('→ Moedas…');
  for (const [code, name, symbol] of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code },
      update: { name, symbol },
      create: { code, name, symbol },
    });
  }
  console.log(`  ${CURRENCIES.length}`);

  console.log('→ Embalagens…');
  for (const name of PACKAGINGS) {
    await prisma.packaging.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`  ${PACKAGINGS.length}`);

  console.log('→ Coberturas…');
  for (const coverage of COVERAGES) {
    await prisma.coverage.upsert({
      where: { name: coverage.name },
      update: { description: coverage.description, accessory: coverage.accessory },
      create: coverage,
    });
  }
  console.log(`  ${COVERAGES.length}`);

  console.log('→ Portos e aeroportos…');
  let portCount = 0;

  for (const [name, code, modal] of BR_PORTS) {
    const existing = await prisma.port.findFirst({ where: { code, modal } });
    if (existing) continue;
    await prisma.port.create({ data: { name, code, modal, countryId: brazil.id } });
    portCount++;
  }

  for (const [name, code, modal, iso2] of FOREIGN_PORTS) {
    const country = await prisma.country.findUnique({ where: { iso2 } });
    if (!country) continue;
    const existing = await prisma.port.findFirst({ where: { code, modal } });
    if (existing) continue;
    await prisma.port.create({ data: { name, code, modal, countryId: country.id } });
    portCount++;
  }
  console.log(`  ${portCount} novos`);

  console.log('→ Tipos de mercadoria…');
  const commodities = [
    { code: 'MAQ', name: 'Máquinas e equipamentos' },
    { code: 'ELE', name: 'Eletroeletrônicos' },
    { code: 'QUI', name: 'Produtos químicos' },
    { code: 'TEX', name: 'Têxteis e confecções' },
    { code: 'ALI', name: 'Alimentos e bebidas' },
    { code: 'AUT', name: 'Autopeças' },
    { code: 'MET', name: 'Metais e siderúrgicos' },
    { code: 'PLA', name: 'Plásticos e resinas' },
    { code: 'MOV', name: 'Móveis' },
    { code: 'OUT', name: 'Outros' },
  ];
  for (const c of commodities) {
    await prisma.commodityType.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
  }
  console.log(`  ${commodities.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
