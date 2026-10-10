import type { Feature, ServiceCategory } from '../../shared/types';

export type FeatureGroup = ServiceCategory | 'Common';

interface FeatureDef {
  name: string;
  unit?: string;
  description: string;
  group: FeatureGroup;
  options: string[];
}

/** 50 feature definitions. `options` and `group` only drive seed generation. */
export const FEATURE_DEFS: FeatureDef[] = [
  // Common (10)
  { name: 'Validity (days)', unit: 'days', description: 'Period the service or license stays valid after activation.', group: 'Common', options: ['30', '90', '180', '365'] },
  { name: 'Support level', description: 'Tier of technical support included with the service.', group: 'Common', options: ['Basic', 'Standard', 'Premium', 'Enterprise'] },
  { name: 'Response time (hours)', unit: 'hours', description: 'Maximum time to first response on a support request.', group: 'Common', options: ['1', '2', '4', '8', '24'] },
  { name: 'Included users', unit: 'users', description: 'Number of named users covered by the base price.', group: 'Common', options: ['1', '5', '10', '25', '50', '100'] },
  { name: 'Delivery format', description: 'How the service is delivered to the customer.', group: 'Common', options: ['Remote', 'On-site', 'Hybrid'] },
  { name: 'Renewal terms', description: 'Billing and renewal cycle of the service.', group: 'Common', options: ['Monthly', 'Quarterly', 'Annual'] },
  { name: 'Documentation included', description: 'Level of documentation delivered with the service.', group: 'Common', options: ['Basic', 'Standard', 'Full'] },
  { name: 'Warranty (days)', unit: 'days', description: 'Days of corrective warranty after delivery.', group: 'Common', options: ['30', '60', '90'] },
  { name: 'Languages supported', description: 'Languages in which service and support are provided.', group: 'Common', options: ['Spanish', 'English', 'English + Spanish'] },
  { name: 'Onboarding included', description: 'Whether an onboarding session is part of the service.', group: 'Common', options: ['Yes', 'No'] },
  // Cloud Infrastructure (7)
  { name: 'Uptime SLA', unit: '%', description: 'Guaranteed monthly availability of the platform.', group: 'Cloud Infrastructure', options: ['99.5', '99.9', '99.95', '99.99'] },
  { name: 'Storage (GB)', unit: 'GB', description: 'Storage capacity allocated to the service.', group: 'Cloud Infrastructure', options: ['100', '250', '500', '1000', '2000'] },
  { name: 'Usage limit', unit: 'requests/day', description: 'Daily request quota before throttling applies.', group: 'Cloud Infrastructure', options: ['10000', '50000', '250000', '1000000'] },
  { name: 'vCPU cores', unit: 'cores', description: 'Virtual CPU cores reserved for the workload.', group: 'Cloud Infrastructure', options: ['2', '4', '8', '16'] },
  { name: 'Data region', description: 'Geographic region where data is stored and processed.', group: 'Cloud Infrastructure', options: ['US East', 'EU West', 'LATAM (Querétaro)', 'US West'] },
  { name: 'Backup frequency', description: 'How often automated backups are taken.', group: 'Cloud Infrastructure', options: ['Hourly', 'Daily', 'Weekly'] },
  { name: 'Bandwidth (TB)', unit: 'TB', description: 'Monthly outbound traffic included.', group: 'Cloud Infrastructure', options: ['1', '5', '10', '25'] },
  // Software Licenses (5)
  { name: 'Licensing model', description: 'Basis on which licenses are counted.', group: 'Software Licenses', options: ['Per user', 'Per device', 'Site license'] },
  { name: 'Maximum devices', unit: 'devices', description: 'Devices on which the license may be installed.', group: 'Software Licenses', options: ['1', '3', '5', '10'] },
  { name: 'Number of environments', unit: 'envs', description: 'Production and non-production environments covered.', group: 'Software Licenses', options: ['1', '2', '3'] },
  { name: 'Single sign-on', description: 'Availability of SSO integration.', group: 'Software Licenses', options: ['Included', 'Not included'] },
  { name: 'Integrations included', description: 'Third-party connectors included in the license.', group: 'Software Licenses', options: ['3', '5', '10', 'Unlimited'] },
  // Support & Maintenance (5)
  { name: 'Business hours coverage', description: 'Window in which support is staffed.', group: 'Support & Maintenance', options: ['8x5', '12x5', '24x7'] },
  { name: 'Escalation levels', unit: 'levels', description: 'Tiers available for incident escalation.', group: 'Support & Maintenance', options: ['2', '3', '4'] },
  { name: 'Monitoring interval (min)', unit: 'min', description: 'Frequency of automated health checks.', group: 'Support & Maintenance', options: ['1', '5', '15'] },
  { name: 'Patch cadence', description: 'How often patches are applied.', group: 'Support & Maintenance', options: ['Weekly', 'Monthly', 'Quarterly'] },
  { name: 'On-site visits per year', unit: 'visits', description: 'Scheduled technician visits included yearly.', group: 'Support & Maintenance', options: ['2', '4', '12'] },
  // Consulting (4)
  { name: 'Consultant seniority', description: 'Seniority level of the assigned consultants.', group: 'Consulting', options: ['Senior', 'Principal', 'Director'] },
  { name: 'Deliverables', unit: 'items', description: 'Formal deliverables produced by the engagement.', group: 'Consulting', options: ['2', '4', '6'] },
  { name: 'Workshop sessions', unit: 'sessions', description: 'Working sessions with the customer team.', group: 'Consulting', options: ['2', '4', '8'] },
  { name: 'Revision rounds', unit: 'rounds', description: 'Rounds of feedback incorporated into deliverables.', group: 'Consulting', options: ['1', '2', '3'] },
  // Training (4)
  { name: 'Training hours', unit: 'hours', description: 'Total instructor-led hours.', group: 'Training', options: ['8', '16', '24', '40'] },
  { name: 'Participants (max)', unit: 'people', description: 'Maximum attendees per cohort.', group: 'Training', options: ['8', '12', '20', '30'] },
  { name: 'Certification included', description: 'Whether an exam voucher or certificate is included.', group: 'Training', options: ['Yes', 'No'] },
  { name: 'Session duration (hours)', unit: 'hours', description: 'Length of each training session.', group: 'Training', options: ['2', '4', '8'] },
  // Security (5)
  { name: 'Scan frequency', description: 'How often automated scans are executed.', group: 'Security', options: ['Weekly', 'Monthly', 'Quarterly'] },
  { name: 'Compliance framework', description: 'Framework the service is aligned with.', group: 'Security', options: ['ISO 27001', 'SOC 2', 'PCI DSS', 'NIST CSF'] },
  { name: 'Encryption standard', description: 'Encryption used for data at rest and in transit.', group: 'Security', options: ['AES-256', 'AES-256 + TLS 1.3'] },
  { name: 'Audit log retention (days)', unit: 'days', description: 'How long audit logs are kept.', group: 'Security', options: ['90', '180', '365'] },
  { name: 'Recovery time objective (hours)', unit: 'hours', description: 'Target time to restore service after an incident.', group: 'Security', options: ['1', '4', '8', '24'] },
  // Data & Analytics (5)
  { name: 'Data export formats', description: 'File formats available for data export.', group: 'Data & Analytics', options: ['CSV', 'CSV + JSON', 'CSV + Parquet'] },
  { name: 'Retention period (days)', unit: 'days', description: 'Period for which historical data is retained.', group: 'Data & Analytics', options: ['90', '365', '730'] },
  { name: 'API calls per month', unit: 'calls', description: 'Monthly API quota for programmatic access.', group: 'Data & Analytics', options: ['100000', '500000', '1000000'] },
  { name: 'Reporting frequency', description: 'Cadence of scheduled reports.', group: 'Data & Analytics', options: ['Daily', 'Weekly', 'Monthly'] },
  { name: 'Recovery point objective (hours)', unit: 'hours', description: 'Maximum tolerated data loss window.', group: 'Data & Analytics', options: ['1', '4', '24'] },
  // Development (5)
  { name: 'Number of sprints', unit: 'sprints', description: 'Two-week sprints included in the scope.', group: 'Development', options: ['1', '2', '4', '6'] },
  { name: 'Team size', unit: 'people', description: 'Engineers assigned to the project.', group: 'Development', options: ['2', '3', '5', '8'] },
  { name: 'Source code ownership', description: 'Who holds the rights over delivered code.', group: 'Development', options: ['Client', 'Shared'] },
  { name: 'Deployment model', description: 'Where the solution is deployed.', group: 'Development', options: ['SaaS', 'On-premise', 'Hybrid'] },
  { name: 'Custom branding', description: 'Whether the UI is branded for the customer.', group: 'Development', options: ['Included', 'Not included'] },
];

export function buildFeatures(): Feature[] {
  return FEATURE_DEFS.map((def, i) => {
    const feature: Feature = {
      id: `feat_${String(i + 1).padStart(3, '0')}`,
      name: def.name,
      description: def.description,
    };
    if (def.unit) feature.unit = def.unit;
    return feature;
  });
}
