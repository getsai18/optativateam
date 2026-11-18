import type { Feature, Service } from '../../shared/types';

export type ServiceInput = Omit<Service, 'id'>;
export type FeatureInput = Omit<Feature, 'id'>;
