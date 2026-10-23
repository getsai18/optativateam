

export interface BuilderLine {
  serviceId: string;
  quantity: number;
}

export interface SaveDraftInput {
  /** present when editing an existing draft */
  id?: string | undefined;
  customerId: string;
  lines: BuilderLine[];
}

export interface TaxBreakdownRow {
  key: string;
  label: string;
  amount: number;
}

