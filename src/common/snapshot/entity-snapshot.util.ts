import { ObjectLiteral, Repository } from 'typeorm';

type SnapshotEntity = Record<string, unknown>;

interface SnapshotTree {
  [key: string]: true | SnapshotTree;
}

const aliasFieldCandidates = {
  code: ['code', 'shortCode', 'accountCode', 'currencyCode', 'documentCode', 'branchCode', 'productCode'],
  name: ['name', 'accountName', 'currencyName', 'documentDescription', 'value', 'label', 'productDescription'],
};

const shouldSkipRelation = (
  parentEntityName: string,
  relationPropertyName: string,
  targetEntityName: string,
) => {
  if (parentEntityName === 'Branch' && relationPropertyName === 'company') {
    return true;
  }

  if (parentEntityName === 'PartyProfile' && relationPropertyName === 'branch') {
    return true;
  }

  if (parentEntityName === 'AccountProfile' && relationPropertyName === 'mapToAccount') {
    return true;
  }

  if (parentEntityName === 'AccountProfile' && relationPropertyName === 'branchToTransfer') {
    return true;
  }

  if (parentEntityName === 'Product' && targetEntityName === 'AccountProfile') {
    return true;
  }

  return false;
};

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstDefinedValue(entity: SnapshotEntity, keys: string[]) {
  for (const key of keys) {
    const value = entity[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function withAliases(entity: SnapshotEntity, metadataName?: string): SnapshotEntity {
  const snapshot: SnapshotEntity = { ...entity };
  const code = firstDefinedValue(snapshot, aliasFieldCandidates.code);
  const name = firstDefinedValue(snapshot, aliasFieldCandidates.name);

  if (snapshot.code === undefined && code !== undefined) {
    snapshot.code = code;
  }

  if (snapshot.name === undefined && name !== undefined) {
    snapshot.name = name;
  }

  if (snapshot.label === undefined) {
    const resolvedCode = snapshot.code ?? code;
    const resolvedName = snapshot.name ?? name;
    if (resolvedCode !== undefined && resolvedName !== undefined) {
      snapshot.label = `${resolvedCode} - ${resolvedName}`;
    } else if (resolvedName !== undefined) {
      snapshot.label = resolvedName;
    } else if (resolvedCode !== undefined) {
      snapshot.label = resolvedCode;
    } else if (metadataName) {
      snapshot.label = metadataName;
    }
  }

  return snapshot;
}

function serializeEntityColumns(entity: SnapshotEntity, metadataName?: string): SnapshotEntity {
  const snapshot: SnapshotEntity = {};
  for (const [key, value] of Object.entries(entity)) {
    if (value !== undefined) {
      snapshot[key] = value;
    }
  }
  return withAliases(snapshot, metadataName);
}

function buildRelationTree(
  metadata: any,
  ancestors = new Set<string>(),
): SnapshotTree {
  const currentAncestors = new Set(ancestors);
  currentAncestors.add(metadata.name);

  const tree: SnapshotTree = {};

  for (const relation of metadata.relations) {
    if (!relation.isManyToOne && !relation.isOneToOneOwner) {
      continue;
    }

    const targetName = relation.inverseEntityMetadata.name;
    if (shouldSkipRelation(metadata.name, relation.propertyName, targetName)) {
      continue;
    }
    if (currentAncestors.has(targetName)) {
      continue;
    }

    const childTree = buildRelationTree(relation.inverseEntityMetadata as any, currentAncestors);
    tree[relation.propertyName] = Object.keys(childTree).length ? childTree : true;
  }

  return tree;
}

function serializeEntitySnapshotRecursive(
  entity: SnapshotEntity,
  metadata: {
    name: string;
    columns: Array<{ propertyName: string }>;
    relations: Array<{
      propertyName: string;
      isManyToOne: boolean;
      isOneToOneOwner: boolean;
      inverseEntityMetadata: {
        name: string;
        columns: Array<{ propertyName: string }>;
        relations: Array<any>;
      };
    }>;
  },
  ancestors = new Set<string>(),
): SnapshotEntity {
  const snapshot = serializeEntityColumns(
    Object.fromEntries(
      metadata.columns.map(column => [column.propertyName, entity[column.propertyName]]),
    ),
    metadata.name,
  );

  const currentAncestors = new Set(ancestors);
  currentAncestors.add(metadata.name);

  for (const relation of metadata.relations) {
    if (!relation.isManyToOne && !relation.isOneToOneOwner) {
      continue;
    }

    const relationValue = entity[relation.propertyName];
    const targetName = relation.inverseEntityMetadata.name;
    if (shouldSkipRelation(metadata.name, relation.propertyName, targetName)) {
      if (relationValue !== undefined) {
        snapshot[relation.propertyName] = isObjectLike(relationValue)
          ? serializeEntityColumns(relationValue, targetName)
          : relationValue;
      }
      continue;
    }

    if (!isObjectLike(relationValue)) {
      if (relationValue !== undefined) {
        snapshot[relation.propertyName] = relationValue;
      }
      continue;
    }

    const nextAncestors = currentAncestors.has(targetName)
      ? currentAncestors
      : currentAncestors;

    if (currentAncestors.has(targetName)) {
      snapshot[relation.propertyName] = serializeEntityColumns(relationValue, targetName);
      continue;
    }

    snapshot[relation.propertyName] = serializeEntitySnapshotRecursive(
      relationValue,
      relation.inverseEntityMetadata,
      nextAncestors,
    );
  }

  return withAliases(snapshot, metadata.name);
}

export async function loadEntitySnapshot<T extends ObjectLiteral>(
  repository: Repository<T>,
  entityId: string | null | undefined,
): Promise<Record<string, unknown> | null> {
  if (!entityId) {
    return null;
  }

  try {
    const relations = buildRelationTree(repository.metadata);
    const entity = await repository.findOne({
      where: { id: entityId } as any,
      relations: Object.keys(relations).length ? (relations as any) : undefined,
    });

    if (!entity) {
      return null;
    }

    return serializeEntitySnapshotRecursive(entity as SnapshotEntity, repository.metadata as any);
  } catch (error) {
    const fallbackEntity = await repository.findOne({
      where: { id: entityId } as any,
    });

    if (!fallbackEntity) {
      return null;
    }

    return serializeEntityColumns(
      Object.fromEntries(
        repository.metadata.columns.map(column => [
          column.propertyName,
          (fallbackEntity as SnapshotEntity)[column.propertyName],
        ]),
      ),
      repository.metadata.name,
    );
  }
}

export function buildEntitySnapshot<T extends ObjectLiteral>(
  entity: T | null | undefined,
  repository: Repository<T>,
): Record<string, unknown> | null {
  if (!entity) {
    return null;
  }

  return serializeEntitySnapshotRecursive(entity as SnapshotEntity, repository.metadata as any);
}
