export interface PropertyRecord {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  acres: string | null;
  status: "available" | "pending" | "sold";
  createdBy: string;
}

export type PropertyCreateInput = {
  createdBy: string;
} & Pick<PropertyRecord, "title"> &
  Partial<Pick<PropertyRecord, "description" | "priceCents" | "acres" | "status">>;

export type PropertyUpdateInput = Partial<
  Pick<PropertyRecord, "title" | "description" | "priceCents" | "acres" | "status">
>;

export interface PropertyStore {
  create(input: PropertyCreateInput): Promise<PropertyRecord>;
  findById(id: string): Promise<PropertyRecord | null>;
  update(id: string, patch: PropertyUpdateInput): Promise<PropertyRecord | null>;
  delete(id: string): Promise<void>;
}

/** Fields a caller is ever allowed to set via the API — never `id` or `createdBy`. */
export const PROPERTY_WRITABLE_FIELDS = ["title", "description", "priceCents", "acres", "status"] as const;
