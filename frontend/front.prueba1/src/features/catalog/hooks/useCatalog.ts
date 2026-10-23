import { useQuery } from '../../../shared/hooks/useQuery';
import { listFeatures, listServices } from '../services/catalogService';

export function useServices() {
  return useQuery(listServices, []);
}

export function useFeatures() {
  return useQuery(listFeatures, []);
}
