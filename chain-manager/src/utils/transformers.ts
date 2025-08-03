/**
 * Utility functions for data transformation between backend and frontend
 */

/**
 * Convert snake_case object keys to camelCase
 */
export function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const camelCaseObj: any = {};
    
    Object.keys(obj).forEach(key => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelCaseObj[camelKey] = toCamelCase(obj[key]);
    });
    
    return camelCaseObj;
  }
  
  return obj;
}

/**
 * Convert camelCase object keys to snake_case
 */
export function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const snakeCaseObj: any = {};
    
    Object.keys(obj).forEach(key => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      snakeCaseObj[snakeKey] = toSnakeCase(obj[key]);
    });
    
    return snakeCaseObj;
  }
  
  return obj;
}

/**
 * Transform branch data from backend to frontend format
 */
export function transformBranch(branch: any) {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    address: branch.address,
    phone: branch.phone,
    email: branch.email,
    managerName: branch.manager_name || branch.manager,
    timezone: branch.timezone,
    currency: branch.currency,
    taxRate: branch.tax_rate,
    isActive: branch.is_active || branch.status === 'active',
    lastSyncAt: branch.last_sync_at,
    apiEndpoint: branch.api_endpoint,
    apiKey: branch.api_key,
    createdAt: branch.created_at,
    updatedAt: branch.updated_at,
  };
}

/**
 * Transform employee data from backend to frontend format
 */
export function transformEmployee(employee: any) {
  return {
    id: employee.id,
    employeeId: employee.employee_id,
    branchId: employee.branch_id,
    name: employee.name,
    role: employee.role,
    phone: employee.phone,
    email: employee.email,
    hireDate: employee.hire_date,
    salary: employee.salary,
    status: employee.status,
    lastLogin: employee.last_login,
    oneCId: employee.onec_id || employee.oneC_id,
    createdAt: employee.created_at,
    updatedAt: employee.updated_at,
  };
}

/**
 * Transform product data from backend to frontend format
 */
export function transformProduct(product: any) {
  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    nameRu: product.name_ru,
    nameUz: product.name_uz,
    description: product.description,
    descriptionRu: product.description_ru,
    descriptionUz: product.description_uz,
    categoryId: product.category_id,
    brand: product.brand,
    unitOfMeasure: product.unit_of_measure,
    basePrice: product.base_price,
    cost: product.cost,
    taxRate: product.tax_rate,
    imageUrl: product.image_url,
    images: product.images,
    attributes: product.attributes,
    isActive: product.is_active,
    oneCId: product.onec_id || product.oneC_id,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

/**
 * Transform category data from backend to frontend format
 */
export function transformCategory(category: any) {
  return {
    id: category.id,
    key: category.key,
    name: category.name,
    nameRu: category.name_ru,
    nameUz: category.name_uz,
    description: category.description,
    descriptionRu: category.description_ru,
    descriptionUz: category.description_uz,
    parentId: category.parent_id,
    sortOrder: category.sort_order,
    isActive: category.is_active,
    oneCId: category.onec_id || category.oneC_id,
    createdAt: category.created_at,
    updatedAt: category.updated_at,
  };
}

/**
 * Transform inventory data from backend to frontend format
 */
export function transformInventory(inventory: any) {
  return {
    id: inventory.id,
    branchId: inventory.branch_id,
    productId: inventory.product_id,
    quantityInStock: inventory.quantity_in_stock,
    reservedQuantity: inventory.reserved_quantity,
    minStockLevel: inventory.min_stock_level,
    maxStockLevel: inventory.max_stock_level,
    reorderPoint: inventory.reorder_point,
    lastCountedAt: inventory.last_counted_at,
    lastMovementAt: inventory.last_movement_at,
  };
}
