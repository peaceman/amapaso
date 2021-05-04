
exports.up = async function(knex) {
    // drop foreign key constraints
    await knex.schema.alterTable('category_product_imports', table => {
        table.dropForeign(['category_id']);
    });

    await knex.schema.alterTable('product_categories', table => {
        table.dropForeign(['category_id']);
    });

    await knex.schema.alterTable('categories', table => {
        table.dropForeign(['root_id']);
        table.dropForeign(['parent_id']);
    });

    // change types
    await knex.schema.alterTable('categories', table => {
        table.bigInteger('id')
            .unsigned()
            .notNullable()
            .alter();

        table.bigInteger('root_id')
            .unsigned()
            .notNullable()
            .references('categories.id')
            .onDelete('cascade')
            .onUpdate('cascade')
            .alter();

        table.bigInteger('parent_id')
            .unsigned()
            .nullable()
            .references('categories.id')
            .onDelete('restrict')
            .onUpdate('cascade')
            .alter();
    });

    await knex.schema.alterTable('category_product_imports', table => {
        table.bigInteger('category_id')
            .unsigned()
            .notNullable()
            .references('categories.id')
            .onDelete('cascade')
            .onUpdate('cascade')
            .alter();
    });

    await knex.schema.alterTable('product_categories', table => {
        table.bigInteger('category_id')
            .unsigned()
            .notNullable()
            .references('categories.id')
            .onDelete('cascade')
            .onUpdate('cascade')
            .alter();
    });
};

exports.down = function(knex) {

};
