import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';

@EventSubscriber()
export class UppercaseSubscriber implements EntitySubscriberInterface {
  /**
   * Listen to all entities.
   */
  listenTo() {
    return Object;
  }

  beforeInsert(event: InsertEvent<any>) {
    this.uppercaseEntityFields(event);
  }

  beforeUpdate(event: UpdateEvent<any>) {
    this.uppercaseEntityFields(event);
  }

  private uppercaseEntityFields(event: InsertEvent<any> | UpdateEvent<any>) {
    const { entity, metadata } = event;
    if (!entity) return;

    // Verify it is one of our core user-facing entities
    const entityClassName = entity.constructor?.name || metadata.targetName;
    const targetEntities = ['Company', 'Branch', 'Counter', 'Currency', 'Role', 'User'];
    if (!targetEntities.includes(entityClassName)) {
      return;
    }

    // Skip technical, structural, or sensitive fields
    const skipFields = [
      'password',
      'logo',
      'website',
      'id',
      'createdBy',
      'updatedBy',
      'deletedBy',
      'createdAt',
      'updatedAt',
    ];

    for (const key of Object.keys(entity)) {
      if (skipFields.includes(key)) {
        continue;
      }
      const val = entity[key];
      if (typeof val === 'string') {
        entity[key] = val.toUpperCase();
      }
    }
  }
}
