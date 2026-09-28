import { Application } from '@jsango/middleware';
import { DatabaseManager } from '@jsango/database';
import { Migration, MigrationRegistry } from '@jsango/migrations';
export declare const initMigration: Migration;
export declare const migrationRegistry: MigrationRegistry;
export declare const User: import("@jsango/orm").DefinedModelStatic<{
    id: import("@jsango/orm").FieldDefinition<unknown>;
    name: import("@jsango/orm").FieldDefinition<unknown>;
    email: import("@jsango/orm").FieldDefinition<unknown>;
}, {
    posts: import("@jsango/orm").RelationOptions;
}>;
export declare const Post: import("@jsango/orm").DefinedModelStatic<{
    id: import("@jsango/orm").FieldDefinition<unknown>;
    userId: import("@jsango/orm").FieldDefinition<unknown>;
    title: import("@jsango/orm").FieldDefinition<unknown>;
}, {
    user: import("@jsango/orm").RelationOptions;
}>;
export declare function createApplication(): {
    app: Application;
    db: DatabaseManager;
};
//# sourceMappingURL=index.d.ts.map