
exports.up = async function(knex) {
    await knex.schema.createTable('product_reviews', table => {
        table.string('id', 32)
            .notNullable()
            .primary();

        table.string('product_asin', 10)
            .notNullable()
            .references('products.asin')
            .onDelete('cascade')
            .onUpdate('cascade');

        table.string('name')
            .notNullable();

        table.string('title')
            .notNullable();

        table.text('content')
            .notNullable();

        table.float('points')
            .notNullable();

        table.date('date')
            .notNullable();

        table.timestamps(true);
    });
};

exports.down = function(knex) {

};
