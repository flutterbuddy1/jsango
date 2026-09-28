import { AdminRegistry } from '@jsango/admin-core';
import { UserResource } from './user-resource.js';
import { ProductResource } from './product-resource.js';
import { OrderResource } from './order-resource.js';
import { User, Product, Order, Page } from '../models/index.js';
import { PageResource } from './pages-resource.js';
export * from './user-resource.js';
export * from './product-resource.js';
export * from './order-resource.js';
export * from './pages-resource.js';
export function createAdminRegistry() {
    const registry = new AdminRegistry();
    registry.register(UserResource);
    registry.register(ProductResource);
    registry.register(OrderResource);
    registry.register(PageResource);
    return registry;
}
/**
 * High-performance Query Adapter that bridges JSango ORM models with the Admin Server CRUD layer.
 */
export function createOrmAdminQueryAdapter() {
    const models = {
        User,
        Product,
        Order,
        Page,
    };
    return {
        async list({ modelName, query, searchFields, defaultSortField, defaultSortDirection, pageSize, }) {
            const model = models[modelName];
            if (!model) {
                throw new Error(`Model '${modelName}' not found in Admin Query Adapter`);
            }
            let q = model.query();
            // Apply search across searchable fields
            if (query.search && searchFields.length > 0) {
                for (const sf of searchFields) {
                    q = q.orWhere(sf, 'like', `%${query.search}%`);
                }
            }
            // Apply column filters
            if (query.filters) {
                for (const [key, value] of Object.entries(query.filters)) {
                    if (value !== undefined && value !== null && value !== '') {
                        let parsed = value;
                        if (value === 'true')
                            parsed = true;
                        else if (value === 'false')
                            parsed = false;
                        q = q.where(key, '=', parsed);
                    }
                }
            }
            // Sorting
            const sortField = query.sort ?? defaultSortField;
            const sortDir = (query.sortDirection ?? defaultSortDirection ?? 'asc').toUpperCase();
            if (sortField) {
                q = q.orderBy(sortField, sortDir);
            }
            // Pagination
            const page = Math.max(1, query.page ?? 1);
            const limit = Math.max(1, query.pageSize ?? pageSize ?? 25);
            const offset = (page - 1) * limit;
            const total = await q.count();
            const items = await q.offset(offset).limit(limit).get();
            return {
                items: items.map((m) => typeof m.toJSON === 'function' ? m.toJSON() : m),
                total,
                page,
                pageSize: limit,
                totalPages: Math.ceil(total / limit) || 1,
            };
        },
        async findById({ modelName, id }) {
            const model = models[modelName];
            if (!model)
                return null;
            const item = await model.query().where('id', '=', id).first();
            return item
                ? typeof item.toJSON === 'function'
                    ? item.toJSON()
                    : item
                : null;
        },
        async create({ modelName, data }) {
            const model = models[modelName];
            if (!model)
                throw new Error(`Model ${modelName} not found`);
            const item = await model.create(data);
            return typeof item.toJSON === 'function'
                ? item.toJSON()
                : item;
        },
        async update({ modelName, id, data }) {
            const model = models[modelName];
            if (!model)
                throw new Error(`Model ${modelName} not found`);
            const item = await model.query().where('id', '=', id).first();
            if (!item)
                throw new Error(`Record with id ${id} not found`);
            Object.assign(item, data);
            await item.save();
            return typeof item.toJSON === 'function'
                ? item.toJSON()
                : item;
        },
        async delete({ modelName, id }) {
            const model = models[modelName];
            if (!model)
                return;
            const item = await model.query().where('id', '=', id).first();
            if (item) {
                await item.delete();
            }
        },
    };
}
//# sourceMappingURL=index.js.map