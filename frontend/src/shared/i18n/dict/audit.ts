import type { DictPair } from '../index';

/** Audit feature: page, filters and table. Raw action codes stay untranslated. */
export const auditDict: DictPair = {
  es: {
    'title': 'Bitácora',
    'description': 'Registro de solo lectura de cada creación, edición, emisión, pago y cancelación.',
    'caption': 'Bitácora',
    'filter.user': 'Usuario',
    'filter.action': 'Acción',
    'filter.allUsers': 'Todos los usuarios',
    'filter.allActions': 'Todas las acciones',
    'col.when': 'Cuándo',
    'col.user': 'Usuario',
    'col.action': 'Acción',
    'col.entity': 'Entidad',
    'col.reference': 'Referencia',
    'loadError.title': 'No se pudo cargar la bitácora',
    'empty.title': 'No hay registros con estos filtros',
    'empty.desc': 'Amplía el rango de fechas o quita los filtros.',
  },
  en: {
    'title': 'Audit log',
    'description': 'Read-only record of every create, update, issue, payment and cancellation.',
    'caption': 'Audit log',
    'filter.user': 'User',
    'filter.action': 'Action',
    'filter.allUsers': 'All users',
    'filter.allActions': 'All actions',
    'col.when': 'When',
    'col.user': 'User',
    'col.action': 'Action',
    'col.entity': 'Entity',
    'col.reference': 'Reference',
    'loadError.title': 'Could not load the audit log',
    'empty.title': 'No entries match your filters',
    'empty.desc': 'Widen the date range or clear the filters.',
  },
};
