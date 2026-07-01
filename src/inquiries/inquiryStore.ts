export interface InquiryRecord {
  id: string;
  propertyId: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: "new" | "contacted" | "closed";
}

export type InquiryCreateInput = {
  propertyId?: string | null;
} & Pick<InquiryRecord, "name" | "email"> &
  Partial<Pick<InquiryRecord, "phone" | "message">>;

export type InquiryUpdateInput = Partial<Pick<InquiryRecord, "status">>;

export interface InquiryStore {
  create(input: InquiryCreateInput): Promise<InquiryRecord>;
  findById(id: string): Promise<InquiryRecord | null>;
  update(id: string, patch: InquiryUpdateInput): Promise<InquiryRecord | null>;
  delete(id: string): Promise<void>;
}

/**
 * The only field an agent can ever write on an inquiry — the lead's own
 * submitted contact details (name/email/phone/message) are never editable
 * via this endpoint.
 */
export const INQUIRY_WRITABLE_FIELDS = ["status"] as const;
