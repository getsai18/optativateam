import { mutate, query } from '../../../mocks/db';
import { requireRole, writeAudit } from '../../../mocks/helpers';
import { latency } from '../../../mocks/latency';
import { ApiError } from '../../../shared/lib/errors';
import { newId } from '../../../shared/lib/id';
import { requireClaims } from '../../../shared/lib/session';
import type { Feature, Service } from '../../../shared/types';
import type { FeatureInput, ServiceInput } from '../types';

// TODO: replace with API Gateway call (GET /services)
export async function listServices(): Promise<Service[]> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN', 'BILLER');
  return query((db) => db.services);
}

// TODO: replace with API Gateway call (POST /services)
export async function createService(input: ServiceInput): Promise<Service> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  return mutate((db) => {
    if (db.services.some((s) => s.code.toLowerCase() === input.code.toLowerCase())) {
      throw new ApiError('CONFLICT', 'A service with this code already exists');
    }
    const service: Service = { ...input, id: newId('svc') };
    db.services.push(service);
    writeAudit(db, claims, 'service.create', 'service', service.id);
    return service;
  });
}

// TODO: replace with API Gateway call (PUT /services/{id})
export async function updateService(id: string, input: ServiceInput): Promise<Service> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  return mutate((db) => {
    const service = db.services.find((s) => s.id === id);
    if (!service) throw new ApiError('NOT_FOUND', 'Service not found');
    if (db.services.some((s) => s.id !== id && s.code.toLowerCase() === input.code.toLowerCase())) {
      throw new ApiError('CONFLICT', 'A service with this code already exists');
    }
    Object.assign(service, input);
    writeAudit(db, claims, 'service.update', 'service', id);
    return service;
  });
}

// TODO: replace with API Gateway call (GET /features)
export async function listFeatures(): Promise<Feature[]> {
  await latency();
  requireClaims();
  return query((db) => db.features);
}

// TODO: replace with API Gateway call (POST /features)
export async function createFeature(input: FeatureInput): Promise<Feature> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  return mutate((db) => {
    if (db.features.some((f) => f.name.toLowerCase() === input.name.toLowerCase())) {
      throw new ApiError('CONFLICT', 'A feature with this name already exists');
    }
    const feature: Feature = { ...input, id: newId('feat') };
    db.features.push(feature);
    writeAudit(db, claims, 'feature.create', 'feature', feature.id);
    return feature;
  });
}

// TODO: replace with API Gateway call (PUT /features/{id})
export async function updateFeature(id: string, input: FeatureInput): Promise<Feature> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  return mutate((db) => {
    const feature = db.features.find((f) => f.id === id);
    if (!feature) throw new ApiError('NOT_FOUND', 'Feature not found');
    if (db.features.some((f) => f.id !== id && f.name.toLowerCase() === input.name.toLowerCase())) {
      throw new ApiError('CONFLICT', 'A feature with this name already exists');
    }
    Object.assign(feature, input);
    if (!input.unit) delete feature.unit;
    writeAudit(db, claims, 'feature.update', 'feature', id);
    return feature;
  });
}

// TODO: replace with API Gateway call (DELETE /features/{id})
export async function deleteFeature(id: string): Promise<void> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  mutate((db) => {
    const usedBy = db.services.filter((s) => s.features.some((f) => f.featureId === id)).length;
    if (usedBy > 0) {
      throw new ApiError('CONFLICT', `This feature is assigned to ${usedBy} service${usedBy === 1 ? '' : 's'} and cannot be deleted`);
    }
    db.features = db.features.filter((f) => f.id !== id);
    writeAudit(db, claims, 'feature.delete', 'feature', id);
  });
}
