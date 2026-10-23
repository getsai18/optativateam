import type { DictPair } from '../index';

export const customersDict: DictPair = {
  es: {
    'page.title': 'Clientes',
    'page.description.admin': 'Crea, edita y desactiva clientes.',
    'page.description.basic': 'Crea y consulta clientes.',
    'action.new': 'Nuevo cliente',

    'table.caption': 'Clientes',
    'table.header.name': 'Nombre',
    'table.header.taxId': 'RFC',
    'table.header.phone': 'Teléfono',
    'table.header.status': 'Estado',
    'table.rowOpen': 'Abrir {name}',
    'status.active': 'Activo',
    'status.inactive': 'Inactivo',

    'search.label': 'Buscar clientes',
    'search.placeholder': 'Busca por nombre, RFC o correo',

    'error.title': 'No se pudieron cargar los clientes',
    'empty.title': 'Aún no tienes clientes',
    'empty.description': 'Crea tu primer cliente para empezar a facturar.',
    'empty.searchTitle': 'No hay coincidencias',
    'empty.searchDescription': 'Prueba con otro nombre, RFC o correo.',

    'drawer.title.new': 'Nuevo cliente',
    'drawer.title.edit': 'Editar cliente',
    'drawer.title.view': 'Cliente',

    'toast.created': 'Cliente creado correctamente',
    'toast.updated': 'Cliente actualizado correctamente',
    'toast.deactivated': 'Cliente desactivado correctamente',

    'deactivate.title': 'Desactivar cliente',
    'deactivate.description':
      'El cliente ya no podrá seleccionarse en facturas nuevas. Las facturas existentes no se ven afectadas y podrás reactivarlo más adelante.',
    'deactivate.confirm': 'Desactivar',

    'form.label.name': 'Nombre',
    'form.label.taxId': 'RFC',
    'form.label.email': 'Correo electrónico',
    'form.label.phone': 'Teléfono',
    'form.label.address': 'Domicilio fiscal',
    'form.hint.taxId': 'Identificador fiscal del cliente. Ejemplo: ABC010101XY1 (12 o 13 caracteres).',
    'form.activeLabel': 'Activo (puede seleccionarse en facturas nuevas)',
    'form.create': 'Crear cliente',

    'error.name.min': 'Escribe el nombre del cliente (mínimo 2 caracteres)',
    'error.name.max': 'El nombre no puede superar los 120 caracteres',
    'error.taxId': 'Escribe un RFC válido, por ejemplo ABC010101XY1 (12 o 13 caracteres)',
    'error.email.required': 'Escribe un correo electrónico',
    'error.email.invalid': 'Escribe un correo válido, por ejemplo nombre@dominio.com',
    'error.phone.max': 'El teléfono no puede superar los 25 caracteres',
    'error.phone.format': 'Usa solo dígitos, espacios y los caracteres + ( ) -',
    'error.address.min': 'Escribe el domicilio fiscal (mínimo 5 caracteres)',
    'error.address.max': 'El domicilio no puede superar los 250 caracteres',
  },
  en: {
    'page.title': 'Customers',
    'page.description.admin': 'Create, edit and deactivate customers.',
    'page.description.basic': 'Create and view customers.',
    'action.new': 'New customer',

    'table.caption': 'Customers',
    'table.header.name': 'Name',
    'table.header.taxId': 'Tax ID',
    'table.header.phone': 'Phone',
    'table.header.status': 'Status',
    'table.rowOpen': 'Open {name}',
    'status.active': 'Active',
    'status.inactive': 'Inactive',

    'search.label': 'Search customers',
    'search.placeholder': 'Search by name, tax ID or email',

    'error.title': 'Could not load customers',
    'empty.title': 'You don’t have customers yet',
    'empty.description': 'Create your first customer to start invoicing.',
    'empty.searchTitle': 'No matches found',
    'empty.searchDescription': 'Try a different name, tax ID or email.',

    'drawer.title.new': 'New customer',
    'drawer.title.edit': 'Edit customer',
    'drawer.title.view': 'Customer',

    'toast.created': 'Customer created successfully',
    'toast.updated': 'Customer updated successfully',
    'toast.deactivated': 'Customer deactivated successfully',

    'deactivate.title': 'Deactivate customer',
    'deactivate.description':
      'The customer can no longer be selected on new invoices. Existing invoices are unaffected and you can reactivate it later.',
    'deactivate.confirm': 'Deactivate',

    'form.label.name': 'Name',
    'form.label.taxId': 'Tax ID',
    'form.label.email': 'Email',
    'form.label.phone': 'Phone',
    'form.label.address': 'Fiscal address',
    'form.hint.taxId': 'Fiscal identifier of the customer. Example: ABC010101XY1 (12 or 13 characters).',
    'form.activeLabel': 'Active (can be selected on new invoices)',
    'form.create': 'Create customer',

    'error.name.min': 'Enter the customer name (at least 2 characters)',
    'error.name.max': 'Name cannot exceed 120 characters',
    'error.taxId': 'Enter a valid tax ID, for example ABC010101XY1 (12 or 13 characters)',
    'error.email.required': 'Enter an email',
    'error.email.invalid': 'Enter a valid email address, for example name@domain.com',
    'error.phone.max': 'Phone cannot exceed 25 characters',
    'error.phone.format': 'Use digits, spaces and the characters + ( ) - only',
    'error.address.min': 'Enter the fiscal address (at least 5 characters)',
    'error.address.max': 'Address cannot exceed 250 characters',
  },
};
