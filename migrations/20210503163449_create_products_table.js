
exports.up = async function(knex) {
    await knex.schema.createTable('products', table => {
        table.string('asin', 10)
            .notNullable()
            .primary();

        table.string('parent_asin', 10)
            .nullable()
            .index();

        table.json('data')
            .notNullable();

        table.timestamps(true);
    });

    await knex.schema.createTable('product_categories', table => {
        table.string('product_asin', 10)
            .notNullable()
            .references('products.asin')
            .onDelete('cascade')
            .onUpdate('cascade');

        table.bigInteger('category_id')
            .notNullable()
            .references('categories.id')
            .onDelete('cascade')
            .onUpdate('cascade');

        table.timestamps(true);
        table.primary(['product_asin', 'category_id']);
    });
};

exports.down = function(knex) {

};
