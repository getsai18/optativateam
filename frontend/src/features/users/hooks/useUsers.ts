import { useQuery } from '../../../shared/hooks/useQuery';
import { listUsers } from '../services/userService';

export function useUsers() {
  return useQuery(listUsers, []);
}
