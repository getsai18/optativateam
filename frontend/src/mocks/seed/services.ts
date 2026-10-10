import type { Feature, Service, ServiceCategory, Tax } from '../../shared/types';
import { FEATURE_DEFS } from './features';
import type { Rng } from './rng';

interface CategorySeed {
  category: ServiceCategory;
  prefix: string;
  priceRange: [number, number];
  names: string[];
  blurb: string;
}

const CATEGORY_SEEDS: CategorySeed[] = [
  {
    category: 'Cloud Infrastructure',
    prefix: 'CLD',
    priceRange: [500, 12000],
    blurb: 'Managed cloud capacity billed monthly, with provisioning and monitoring handled by Northwind.',
    names: [
      'Managed Kubernetes Cluster', 'Virtual Server Hosting (4 vCPU)', 'Object Storage 1 TB', 'Managed PostgreSQL Instance',
      'Load Balancer Service', 'Content Delivery Network', 'Dedicated Bare-Metal Server', 'Private Network & VPN Gateway',
      'Disaster Recovery Replication', 'Container Registry', 'Managed Redis Cache', 'Serverless Functions Bundle',
      'Cloud Migration Landing Zone',
    ],
  },
  {
    category: 'Software Licenses',
    prefix: 'LIC',
    priceRange: [150, 9000],
    blurb: 'Licensed software resold with activation, renewal tracking and vendor escalation.',
    names: [
      'Collaboration Suite License (per user)', 'Endpoint Antivirus License', 'ERP Standard License', 'CRM Professional License',
      'BI Analytics Viewer License', 'Design Tool Team License', 'Project Management License', 'Document Signing License',
      'Database Enterprise License', 'Virtualization Platform License', 'Backup Software License', 'Helpdesk Agent License',
      'Accounting Suite License',
    ],
  },
  {
    category: 'Support & Maintenance',
    prefix: 'SUP',
    priceRange: [800, 15000],
    blurb: 'Ongoing operational support delivered under a defined service level.',
    names: [
      'Standard Support Plan (8x5)', 'Premium Support Plan (24x7)', 'On-Site Technician Visit', 'Preventive Maintenance Package',
      'Remote Monitoring Service', 'Patch Management Service', 'Incident Response Retainer', 'Hardware Warranty Extension',
      'Dedicated Support Engineer', 'Help Desk Outsourcing', 'Software Update Subscription', 'Network Health Check',
      'Annual Maintenance Contract',
    ],
  },
  {
    category: 'Consulting',
    prefix: 'CON',
    priceRange: [4000, 25000],
    blurb: 'Advisory engagement led by senior consultants with written deliverables.',
    names: [
      'IT Strategy Assessment', 'Digital Transformation Roadmap', 'Architecture Review', 'Process Automation Workshop',
      'Vendor Selection Advisory', 'Cloud Cost Optimization Audit', 'Compliance Readiness Assessment', 'Data Governance Consulting',
      'Technical Due Diligence', 'Agile Coaching Engagement', 'IT Budget Planning', 'Business Continuity Planning',
      'Fractional CTO (monthly)',
    ],
  },
  {
    category: 'Training',
    prefix: 'TRN',
    priceRange: [1500, 12000],
    blurb: 'Instructor-led training for technical and non-technical teams.',
    names: [
      'Cloud Fundamentals Workshop', 'Cybersecurity Awareness Course', 'Advanced SQL Bootcamp', 'Kubernetes Administration Course',
      'Data Analytics with Python', 'Agile & Scrum Certification Prep', 'Executive Digital Literacy Session', 'DevOps Practices Workshop',
      'Office Productivity Training', 'Secure Coding Workshop', 'Power BI Hands-On Course', 'Onboarding Training Package',
      'E-Learning Platform Access',
    ],
  },
  {
    category: 'Security',
    prefix: 'SEC',
    priceRange: [2500, 22000],
    blurb: 'Security assessments and managed controls aligned with recognised frameworks.',
    names: [
      'Penetration Test (Web Application)', 'Vulnerability Scanning Subscription', 'Managed Firewall Service',
      'Security Operations Monitoring (SOC)', 'Phishing Simulation Campaign', 'Identity & Access Review',
      'Endpoint Detection & Response', 'Security Policy Development', 'Incident Forensics Analysis',
      'Multi-Factor Authentication Rollout', 'Cloud Security Posture Review', 'Email Security Gateway', 'ISO 27001 Gap Assessment',
    ],
  },
  {
    category: 'Data & Analytics',
    prefix: 'DAT',
    priceRange: [5000, 25000],
    blurb: 'Data platform and analytics work, from ingestion to reporting.',
    names: [
      'Data Warehouse Setup', 'ETL Pipeline Development', 'Executive Dashboard Package', 'Data Quality Assessment',
      'Predictive Model Prototype', 'Customer Segmentation Analysis', 'Real-Time Streaming Pipeline', 'Data Lake Implementation',
      'Reporting Automation', 'Master Data Management Setup', 'Analytics Self-Service Enablement', 'Data Catalog Deployment',
      'Forecasting Model Subscription',
    ],
  },
  {
    category: 'Development',
    prefix: 'DEV',
    priceRange: [6000, 25000],
    blurb: 'Software engineering delivered by dedicated squads in fixed-length sprints.',
    names: [
      'Custom Web Application (sprint)', 'Mobile App Development (sprint)', 'REST API Development', 'Legacy System Modernization',
      'QA Test Automation Suite', 'UX/UI Design Package', 'E-commerce Platform Build', 'System Integration Project',
      'DevOps Pipeline Setup', 'Technical Documentation Package', 'Proof-of-Concept Prototype', 'Maintenance Retainer (40 hrs)',
      'Open-Source Component Customization',
    ],
  },
];

const TOTAL_SERVICES = 100;

export function buildServices(rng: Rng, taxes: Tax[], features: Feature[]): Service[] {
  const vat16 = taxes.find((t) => t.code === 'VAT16');
  const vat0 = taxes.find((t) => t.code === 'VAT0');
  const ieps = taxes.find((t) => t.code === 'IEPS');
  if (!vat16 || !vat0 || !ieps) throw new Error('Seed taxes missing');

  const featureIdByName = new Map(features.map((f) => [f.name, f.id]));
  const perCategory = Math.floor(TOTAL_SERVICES / CATEGORY_SEEDS.length);
  const extra = TOTAL_SERVICES - perCategory * CATEGORY_SEEDS.length;

  const services: Service[] = [];
  CATEGORY_SEEDS.forEach((seed, catIndex) => {
    const count = perCategory + (catIndex < extra ? 1 : 0);
    const common = FEATURE_DEFS.filter((d) => d.group === 'Common');
    const specific = FEATURE_DEFS.filter((d) => d.group === seed.category);

    seed.names.slice(0, count).forEach((name, i) => {
      const [min, max] = seed.priceRange;
      const basePrice = Math.round((min + rng.next() * (max - min)) / 50) * 50 || min;

      const taxIds = [rng.chance(0.1) ? vat0.id : vat16.id];
      if (rng.chance(0.15)) taxIds.push(ieps.id);

      const featureCount = rng.int(3, 6);
      const commonCount = Math.min(common.length, rng.int(1, 2));
      const chosen = [
        ...rng.shuffle(common).slice(0, commonCount),
        ...rng.shuffle(specific).slice(0, Math.max(1, featureCount - commonCount)),
      ].slice(0, featureCount);

      services.push({
        id: `svc_${seed.prefix.toLowerCase()}_${String(i + 1).padStart(2, '0')}`,
        code: `${seed.prefix}-${String(100 + i + 1)}`,
        name,
        description: `${name}. ${seed.blurb}`,
        basePrice: Math.min(25000, Math.max(150, basePrice)),
        category: seed.category,
        taxIds,
        features: chosen.flatMap((def) => {
          const featureId = featureIdByName.get(def.name);
          return featureId ? [{ featureId, value: rng.pick(def.options) }] : [];
        }),
        active: true,
      });
    });
  });
  return services;
}
