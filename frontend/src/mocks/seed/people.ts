import type { Customer, User } from '../../shared/types';
import type { Rng } from './rng';

interface CustomerSeed {
  name: string;
  slug: string;
  kind: 'company' | 'person';
  address: string;
}

const CUSTOMER_SEEDS: CustomerSeed[] = [
  { name: 'Grupo Alameda Logística S.A. de C.V.', slug: 'alameda', kind: 'company', address: 'Calzada de las Bombas 120, Coyoacán, 04940 Ciudad de México, CDMX' },
  { name: 'Constructora Tezontle S.A. de C.V.', slug: 'tezontle', kind: 'company', address: 'Av. Insurgentes Sur 1602, Crédito Constructor, 03940 Ciudad de México, CDMX' },
  { name: 'Farmacias del Valle S.A. de C.V.', slug: 'farmaciasdelvalle', kind: 'company', address: 'Av. Constitución 880, Centro, 64000 Monterrey, N.L.' },
  { name: 'Textiles Monarca S.A. de C.V.', slug: 'monarca', kind: 'company', address: 'Blvd. Adolfo López Mateos 2300, Los Gavilanes, 37240 León, Gto.' },
  { name: 'Agroindustrias San Ángel S.A.P.I. de C.V.', slug: 'sanangel', kind: 'company', address: 'Carretera Culiacán-Eldorado km 12, 80000 Culiacán, Sin.' },
  { name: 'Clínica Santa Lucía S.C.', slug: 'santalucia', kind: 'company', address: 'Calle 60 No. 487, Centro, 97000 Mérida, Yuc.' },
  { name: 'Transportes Cuauhtémoc S.A. de C.V.', slug: 'tcuauhtemoc', kind: 'company', address: 'Av. Industrial 455, Parque Industrial, 25900 Ramos Arizpe, Coah.' },
  { name: 'Café Altiplano S.A. de C.V.', slug: 'cafealtiplano', kind: 'company', address: 'Calle Hidalgo 34, Centro, 29200 San Cristóbal de las Casas, Chis.' },
  { name: 'Estudios Jurídicos Reforma S.C.', slug: 'juridicosreforma', kind: 'company', address: 'Paseo de la Reforma 505, Cuauhtémoc, 06500 Ciudad de México, CDMX' },
  { name: 'Manufacturas Precisión del Bajío S.A. de C.V.', slug: 'precisionbajio', kind: 'company', address: 'Av. Tecnológico 1200, Parque Industrial, 76120 Querétaro, Qro.' },
  { name: 'Inmobiliaria Cumbres S.A. de C.V.', slug: 'cumbres', kind: 'company', address: 'Av. Lázaro Cárdenas 2400, Valle Oriente, 66269 San Pedro Garza García, N.L.' },
  { name: 'Aceros Monterrey Industriales S.A. de C.V.', slug: 'acerosmty', kind: 'company', address: 'Carretera Nacional km 8, 67300 Santiago, N.L.' },
  { name: 'Colegio Horizonte A.C.', slug: 'colegiohorizonte', kind: 'company', address: 'Av. Vallarta 3100, Arcos Vallarta, 44130 Guadalajara, Jal.' },
  { name: 'Hotel Plaza Candelaria S.A. de C.V.', slug: 'plazacandelaria', kind: 'company', address: 'Calle 16 de Septiembre 12, Centro, 68000 Oaxaca, Oax.' },
  { name: 'Energía Solar Mexicana S.A.P.I. de C.V.', slug: 'solarmx', kind: 'company', address: 'Blvd. Kukulcán km 9, Zona Hotelera, 77500 Cancún, Q. Roo' },
  { name: 'Editorial Tinta Nueva S.A. de C.V.', slug: 'tintanueva', kind: 'company', address: 'Calle Donceles 71, Centro Histórico, 06010 Ciudad de México, CDMX' },
  { name: 'Distribuidora Pacífico S.A. de C.V.', slug: 'dpacifico', kind: 'company', address: 'Av. del Mar 880, Centro, 82000 Mazatlán, Sin.' },
  { name: 'Laboratorios Avance Clínico S.A. de C.V.', slug: 'avanceclinico', kind: 'company', address: 'Av. Universidad 1900, Del Valle, 03100 Ciudad de México, CDMX' },
  { name: 'Mariana Ortega Villaseñor', slug: 'mortega', kind: 'person', address: 'Calle Durango 210, Roma Norte, 06700 Ciudad de México, CDMX' },
  { name: 'Rodrigo Salazar Fuentes', slug: 'rsalazar', kind: 'person', address: 'Av. Chapultepec 1450, Americana, 44160 Guadalajara, Jal.' },
  { name: 'Elena Barrios Montoya', slug: 'ebarrios', kind: 'person', address: 'Calle 5 de Mayo 78, Centro, 72000 Puebla, Pue.' },
  { name: 'Héctor Domínguez Ibarra', slug: 'hdominguez', kind: 'person', address: 'Calle Morelos 301, Centro, 62000 Cuernavaca, Mor.' },
  { name: 'Lucía Cervantes Aguirre', slug: 'lcervantes', kind: 'person', address: 'Av. Juárez 905, Centro, 20000 Aguascalientes, Ags.' },
  { name: 'Andrés Pineda Lozano', slug: 'apineda', kind: 'person', address: 'Calle Allende 66, Centro, 58000 Morelia, Mich.' },
  { name: 'Valeria Ruiz Echeverría', slug: 'vruiz', kind: 'person', address: 'Av. Hidalgo 412, Centro, 78000 San Luis Potosí, S.L.P.' },
];

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

export function buildCustomers(rng: Rng): Customer[] {
  return CUSTOMER_SEEDS.map((seed, i) => {
    const letters = seed.kind === 'company' ? 3 : 4;
    const yy = String(rng.int(80, 99));
    const date = `${yy}${String(rng.int(1, 12)).padStart(2, '0')}${String(rng.int(1, 28)).padStart(2, '0')}`;
    const taxId = `${rng.code(LETTERS, letters)}${date}${rng.code(ALNUM, 3)}`;
    const customer: Customer = {
      id: `cus_${String(i + 1).padStart(3, '0')}`,
      name: seed.name,
      taxId,
      email: seed.kind === 'company' ? `billing@${seed.slug}.example` : `${seed.slug}@mail.example`,
      address: seed.address,
      active: true,
    };
    if (rng.chance(0.8)) {
      customer.phone = `+52 55 ${rng.int(1000, 9999)} ${rng.int(1000, 9999)}`;
    }
    return customer;
  });
}

export const DEMO_PASSWORD = 'demo1234';

export function buildUsers(customers: Customer[]): User[] {
  const staff: User[] = [
    { id: 'usr_admin', email: 'admin@northwind.test', fullName: 'Sofía Navarro', role: 'ADMIN', active: true },
    { id: 'usr_biller1', email: 'biller@northwind.test', fullName: 'Diego Herrera', role: 'BILLER', active: true },
    { id: 'usr_biller2', email: 'biller2@northwind.test', fullName: 'Camila Torres', role: 'BILLER', active: true },
  ];
  const contacts = ['Ricardo Meza', 'Paola Estrada', 'Tomás Rangel', 'Ximena Duarte', 'Gabriel Soto'];
  const clientUsers: User[] = contacts.flatMap((fullName, i) => {
    const customer = customers[i];
    if (!customer) return [];
    return [
      {
        id: `usr_cus${i + 1}`,
        email: `customer${i === 0 ? '' : i + 1}@client.test`,
        fullName,
        role: 'CUSTOMER' as const,
        customerId: customer.id,
        active: true,
      },
    ];
  });
  return [...staff, ...clientUsers];
}
