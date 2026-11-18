import type { DictPair } from '../index';

export const usersDict: DictPair = {
  es: {
    'page.title': 'Usuarios',
    'page.description': 'Crea cuentas, cambia roles y activa o desactiva el acceso.',
    'action.new': 'Nuevo usuario',

    'table.caption': 'Usuarios',
    'table.header.name': 'Nombre',
    'table.header.role': 'Rol',
    'table.header.customer': 'Cliente vinculado',
    'table.header.status': 'Estado',
    'table.rowEdit': 'Editar {name}',
    'status.active': 'Activo',
    'status.inactive': 'Inactivo',

    'search.label': 'Buscar usuarios',
    'search.placeholder': 'Busca por nombre o correo',

    'empty.title': 'Aún no hay usuarios',
    'empty.description': 'Crea cuentas para dar acceso al sistema.',
    'empty.searchTitle': 'No hay coincidencias',
    'empty.searchDescription': 'Prueba con otro nombre o correo.',

    'drawer.title.new': 'Nuevo usuario',
    'drawer.title.edit': 'Editar usuario',

    'toast.created': 'Usuario creado correctamente',
    'toast.updated': 'Usuario actualizado correctamente',
    'toast.deactivated': 'Usuario desactivado correctamente',

    'deactivate.title': 'Desactivar usuario',
    'deactivate.description': 'El usuario no podrá iniciar sesión hasta que su cuenta se reactive.',
    'deactivate.confirm': 'Desactivar',

    'form.label.fullName': 'Nombre completo',
    'form.label.email': 'Correo electrónico',
    'form.label.role': 'Rol',
    'form.label.customer': 'Cliente',
    'form.customerPlaceholder': 'Selecciona un cliente…',
    'form.selfRoleHint': 'No puedes cambiar tu propio rol',
    'form.activeLabel': 'Activo (puede iniciar sesión)',
    'form.create': 'Crear usuario',

    'error.fullName.min': 'Escribe el nombre completo (mínimo 2 caracteres)',
    'error.fullName.max': 'El nombre no puede superar los 80 caracteres',
    'error.email.required': 'Escribe un correo electrónico',
    'error.email.invalid': 'Escribe un correo válido, por ejemplo nombre@dominio.com',
    'error.customerId': 'Selecciona el cliente al que pertenece este usuario',
  },
  en: {
    'page.title': 'Users',
    'page.description': 'Create accounts, change roles and activate or deactivate access.',
    'action.new': 'New user',

    'table.caption': 'Users',
    'table.header.name': 'Name',
    'table.header.role': 'Role',
    'table.header.customer': 'Linked customer',
    'table.header.status': 'Status',
    'table.rowEdit': 'Edit {name}',
    'status.active': 'Active',
    'status.inactive': 'Inactive',

    'search.label': 'Search users',
    'search.placeholder': 'Search by name or email',

    'empty.title': 'There are no users yet',
    'empty.description': 'Create accounts to give people access to the system.',
    'empty.searchTitle': 'No matches found',
    'empty.searchDescription': 'Try a different name or email.',

    'drawer.title.new': 'New user',
    'drawer.title.edit': 'Edit user',

    'toast.created': 'User created successfully',
    'toast.updated': 'User updated successfully',
    'toast.deactivated': 'User deactivated successfully',

    'deactivate.title': 'Deactivate user',
    'deactivate.description': 'The user will not be able to sign in until their account is reactivated.',
    'deactivate.confirm': 'Deactivate',

    'form.label.fullName': 'Full name',
    'form.label.email': 'Email',
    'form.label.role': 'Role',
    'form.label.customer': 'Customer',
    'form.customerPlaceholder': 'Select a customer…',
    'form.selfRoleHint': 'You cannot change your own role',
    'form.activeLabel': 'Active (can sign in)',
    'form.create': 'Create user',

    'error.fullName.min': 'Enter the full name (at least 2 characters)',
    'error.fullName.max': 'Name cannot exceed 80 characters',
    'error.email.required': 'Enter an email',
    'error.email.invalid': 'Enter a valid email address, for example name@domain.com',
    'error.customerId': 'Choose the customer this user belongs to',
  },
};
