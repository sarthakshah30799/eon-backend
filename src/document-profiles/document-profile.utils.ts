import { SelectQueryBuilder } from 'typeorm';
import { DocumentProfile } from './document-profile.entity';
import { DocumentProfileRule } from './document-profile-rule.entity';

export const normalizeSelectionValue = (value?: string | null) =>
  value?.trim() || null;

export const normalizeSpecificationTypeValue = (value?: string | null) =>
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
  specificationType: normalizeSpecificationTypeValue(profile.specificationType) ?? profile.specificationType,
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

export interface DocumentProfileFilterValues {
  specificationType?: string | null;
  type?: string | null;
  groupSelection?: string | null;
  entitySelection?: string | null;
  activeOnly?: boolean;
  activeRulesOnly?: boolean;
}

export const applyDocumentProfileFilters = <T extends Record<string, any>>(
  queryBuilder: SelectQueryBuilder<T>,
  documentProfileAlias: string,
  ruleAlias: string | null,
  filters: DocumentProfileFilterValues,
) => {
  const specificationType = normalizeSpecificationTypeValue(filters.specificationType);
  const type = normalizeSelectionValue(filters.type);
  const groupSelection = normalizeSelectionValue(filters.groupSelection);
  const entitySelection = normalizeSelectionValue(filters.entitySelection);

  if (filters.activeOnly) {
    queryBuilder.andWhere(`${documentProfileAlias}.active = true`);
  }

  if (filters.activeRulesOnly && ruleAlias) {
    queryBuilder.andWhere(`${ruleAlias}.active = true`);
  }

  if (specificationType) {
    queryBuilder.andWhere(`${documentProfileAlias}.specificationType = :documentProfileSpecificationType`, {
      documentProfileSpecificationType: specificationType,
    });
  }

  if (type) {
    queryBuilder.andWhere(`${documentProfileAlias}.type = :documentProfileType`, {
      documentProfileType: type,
    });
  }

  if (groupSelection) {
    queryBuilder.andWhere(`${documentProfileAlias}.groupSelection = :documentProfileGroupSelection`, {
      documentProfileGroupSelection: groupSelection,
    });
  }

  if (entitySelection) {
    queryBuilder.andWhere(`${documentProfileAlias}.entitySelection = :documentProfileEntitySelection`, {
      documentProfileEntitySelection: entitySelection,
    });
  }

  return queryBuilder;
};
