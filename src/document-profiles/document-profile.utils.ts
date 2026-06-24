import { SelectQueryBuilder } from 'typeorm';
import { DocumentProfile, DocumentSpecificationType } from './document-profile.entity';

export const normalizeSelectionValue = (value?: string | null) =>
  value?.trim() || null;

export const normalizeSpecificationTypeValue = (value?: string | null) =>
  value?.trim().toUpperCase() || null;

export const normalizeDocumentProfilePayload = (
  profile: Pick<
    DocumentProfile,
    | 'documentCode'
    | 'documentDescription'
    | 'documentType'
    | 'isRequired'
    | 'maxSizeMb'
    | 'specificationType'
    | 'type'
    | 'groupSelection'
    | 'entitySelection'
    | 'active'
    | 'sortOrder'
  >,
) => ({
  ...profile,
  documentCode: profile.documentCode.trim().toUpperCase(),
  documentDescription: profile.documentDescription.trim(),
  documentType: Array.from(
    new Set(
      profile.documentType.map(
        type => normalizeSelectionValue(type) ?? type.trim().toUpperCase(),
      ),
    ),
  ),
  specificationType:
    (normalizeSpecificationTypeValue(profile.specificationType) ??
      profile.specificationType) as DocumentSpecificationType,
  type: profile.type,
  groupSelection: profile.groupSelection,
  entitySelection: profile.entitySelection,
});

export const resolveDocumentProfile = (
  profile: DocumentProfile,
): DocumentProfile => {
  return {
    ...profile,
    documentCode: profile.documentCode.trim().toUpperCase(),
    documentDescription: profile.documentDescription.trim(),
    documentType: Array.from(
      new Set(
        (profile.documentType ?? []).map(
          type => normalizeSelectionValue(type) ?? type.trim().toUpperCase(),
        ),
      ),
    ),
    specificationType:
      (normalizeSpecificationTypeValue(profile.specificationType) ??
        profile.specificationType) as DocumentSpecificationType,
    type: profile.type,
    groupSelection: profile.groupSelection,
    entitySelection: profile.entitySelection,
  };
};

export interface DocumentProfileFilterValues {
  specificationType?: string | null;
  type?: string | null;
  groupSelection?: string | null;
  entitySelection?: string | null;
  activeOnly?: boolean;
}

export const applyDocumentProfileFilters = <T extends Record<string, any>>(
  queryBuilder: SelectQueryBuilder<T>,
  documentProfileAlias: string,
  filters: DocumentProfileFilterValues,
) => {
  const specificationType = normalizeSpecificationTypeValue(filters.specificationType);
  const type = normalizeSelectionValue(filters.type);
  const groupSelection = normalizeSelectionValue(filters.groupSelection);
  const entitySelection = normalizeSelectionValue(filters.entitySelection);

  if (filters.activeOnly) {
    queryBuilder.andWhere(`${documentProfileAlias}.active = true`);
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
