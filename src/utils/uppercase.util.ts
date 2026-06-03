export function uppercaseFields<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  const fieldsToUpper = [
    'shortCode',
    'name',
    'formerlyKnownName',
    'cinNo',
    'panNo',
    'fxRegNo',
    'aeonLicNo',
    'email',
    'code',
    'branchName',
    'address1',
    'address2',
    'address3',
    'city',
    'state',
    'gstState',
    'gstNo',
    'contactName',
    'contactNo',
    'branchEmail',
    'aeonBranchLic',
    'counterNo',
    'code',
    'email',
    'employeeNo',
    'designation',
    'userLicNo',
  ];

  const result = { ...obj } as Record<string, any>;
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (fieldsToUpper.includes(key) && typeof val === 'string') {
      result[key] = val.toUpperCase() as any;
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = uppercaseFields(val);
    }
  }
  return result as T;
}
