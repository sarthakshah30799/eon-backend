import { DocumentProfile } from './document-profile.entity';
import { DocumentProfileRule } from './document-profile-rule.entity';

export const normalizeSelectionValue = (value?: string | null) =>
  value?.trim().toUpperCase() || null;

export const normalizeDocumentProfilePayload = (
  profile: Pick<
    DocumentProfile,
    | 'specificationType'
    | 'type'
    | 'groupSelection'
    | 'entitySelection'
    | 'profileDescription'
    | 'active'
    | 'sortOrder'
  >,
) => ({
  ...profile,
  specificationType:
    normalizeSelectionValue(profile.specificationType) ?? profile.specificationType,
  type: profile.type.trim(),
  groupSelection: normalizeSelectionValue(profile.groupSelection),
  entitySelection: normalizeSelectionValue(profile.entitySelection),
  profileDescription: profile.profileDescription?.trim() || null,
});

export const normalizeDocumentProfileRulePayload = (
  rule: {
    documentCode: string;
    documentDescription: string;
    documentType: string[];
    isRequired?: boolean;
    maxSizeMb: number;
    active?: boolean;
    sortOrder?: number;
  },
) => ({
  ...rule,
  documentCode: normalizeSelectionValue(rule.documentCode) ?? rule.documentCode,
  documentDescription: rule.documentDescription.trim(),
  documentType: Array.from(
    new Set(
      rule.documentType.map(
        type => normalizeSelectionValue(type) ?? type.trim().toUpperCase(),
      ),
    ),
  ),
});

export const resolveDocumentProfileRules = (
  rules: DocumentProfileRule[],
): DocumentProfileRule[] => {
  return rules
    .filter(rule => rule.active)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.documentCode.localeCompare(right.documentCode));
};
