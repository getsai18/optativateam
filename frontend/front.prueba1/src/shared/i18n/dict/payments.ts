import type { DictPair } from '../index';

export const paymentsDict: DictPair = {
  es: {
    'dialog.title': 'Registrar pago',
    'dialog.doneTitle': 'Pago registrado',
    'dialog.invoice': 'Factura {folio}',
    'dialog.methodLegend': 'Método de pago',
    'dialog.confirm': 'Confirmar pago de {amount}',
    'dialog.simulated':
      'Pago simulado. No se capturan datos de tarjeta; se genera una referencia como SIM-8F3K2A y la factura se marca como pagada.',
    'dialog.reference': 'Referencia',
    'toast.success': 'Pago registrado correctamente',

    'history.caption': 'Historial de pagos',
    'history.empty': 'Sin pagos registrados todavía.',
    'history.header.date': 'Fecha',
    'history.header.method': 'Método',
    'history.header.reference': 'Referencia',
    'history.header.amount': 'Importe',
  },
  en: {
    'dialog.title': 'Register payment',
    'dialog.doneTitle': 'Payment registered',
    'dialog.invoice': 'Invoice {folio}',
    'dialog.methodLegend': 'Payment method',
    'dialog.confirm': 'Confirm payment of {amount}',
    'dialog.simulated':
      'Simulated payment. No card details are captured; a reference such as SIM-8F3K2A is generated and the invoice is marked as paid.',
    'dialog.reference': 'Reference',
    'toast.success': 'Payment registered successfully',

    'history.caption': 'Payment history',
    'history.empty': 'No payments registered yet.',
    'history.header.date': 'Date',
    'history.header.method': 'Method',
    'history.header.reference': 'Reference',
    'history.header.amount': 'Amount',
  },
};
