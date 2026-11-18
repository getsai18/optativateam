import { api } from '../../../shared/lib/http';
import type { Feature, Service } from '../../../shared/types';
import type { FeatureInput, ServiceInput } from '../types';

export async function listServices(): Promise<Service[]> {
  return api<Service[]>('/services');
}

export async function createService(input: ServiceInput): Promise<Service> {
  return api<Service>('/services', { method: 'POST', body: input });
}

export async function updateService(id: string, input: ServiceInput): Promise<Service> {
  return api<Service>(`/services/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
}

export async function listFeatures(): Promise<Feature[]> {
  return api<Feature[]>('/features');
}

export async function createFeature(input: FeatureInput): Promise<Feature> {
  return api<Feature>('/features', { method: 'POST', body: input });
}

export async function updateFeature(id: string, input: FeatureInput): Promise<Feature> {
  return api<Feature>(`/features/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
}

export async function deleteFeature(id: string): Promise<void> {
  await api<unknown>(`/features/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
