import { DocumentProfile } from './document-profile.entity';
import { DocumentProfileRule } from './document-profile-rule.entity';
import { ResolveDocumentProfileRulesDto } from './dto/resolve-document-profile-rules.dto';

const normalizeToken = (value?: string | null) =>
  value?.trim().toUpperCase() || null;

export const normalizeDocumentProfilePayload = (
  profile: Pick<DocumentProfile, 'profileCode' | 'profileName' | 'profileDescription' | 'active' | 'sortOrder'>,
) => ({
  ...profile,
  profileCode: normalizeToken(profile.profileCode) ?? profile.profileCode,
  profileName: profile.profileName.trim(),
  profileDescription: profile.profileDescription?.trim() || null,
});

export const normalizeDocumentProfileRulePayload = (
  rule: {
    documentCode: string;
    documentDescription: string;
    documentType: string;
    isRequired?: boolean;
    maxSizeMb: number;
    profileSelection?: string | null;
    entitySelection?: string | null;
    fieldSelection?: string | null;
    fieldValue?: string | null;
    active?: boolean;
    sortOrder?: number;
  },
) => ({
  ...rule,
  documentCode: normalizeToken(rule.documentCode) ?? rule.documentCode,
  documentDescription: rule.documentDescription.trim(),
  documentType: normalizeToken(rule.documentType) ?? rule.documentType,
  profileSelection: normalizeToken(rule.profileSelection),
  entitySelection: normalizeToken(rule.entitySelection),
  fieldSelection: normalizeToken(rule.fieldSelection),
  fieldValue: normalizeToken(rule.fieldValue),
});

const matchesToken = (
  ruleValue: string | null,
  queryValue: string | null,
): boolean => {
  if (!ruleValue) {
    return true;
  }

  return ruleValue === queryValue;
};

export const resolveDocumentProfileRules = (
  rules: DocumentProfileRule[],
  query: ResolveDocumentProfileRulesDto,
): DocumentProfileRule[] => {
  const profileSelection = normalizeToken(query.profileSelection);
  const entitySelection = normalizeToken(query.entitySelection);
  const fieldSelection = normalizeToken(query.fieldSelection);
  const fieldValue = normalizeToken(query.fieldValue);

  return rules
    .filter(rule => rule.active)
    .filter(rule => matchesToken(normalizeToken(rule.profileSelection), profileSelection))
    .filter(rule => matchesToken(normalizeToken(rule.entitySelection), entitySelection))
    .filter(rule => matchesToken(normalizeToken(rule.fieldSelection), fieldSelection))
    .filter(rule => matchesToken(normalizeToken(rule.fieldValue), fieldValue))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.documentCode.localeCompare(right.documentCode));
};
